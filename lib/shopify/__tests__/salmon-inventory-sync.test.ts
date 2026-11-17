import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSalmonStockSource, SALMON_STOCK } from '../salmon-stock-source.ts';
import { readSalmonOrderDemand, verifyDemandCoverage } from '../salmon-order-demand.ts';
import { runSalmonInventorySync } from '../salmon-inventory-sync.ts';

const domain = 'example.myshopify.com';
function sourceFixture() {
  const product = { id: SALMON_STOCK.productId, unit: 'g', status: 'active', productCategory: 'STANDARD', inventorySourceProductId: null,
    priceTiers: [{ id: SALMON_STOCK.tierId, weightGrams: 50, unit: 'g', unitQty: 1, shopifySku: SALMON_STOCK.sku,
      shopifyVariantId: '64882303271289', inventoryPolicy: 'shared', _count: { bundleComponents: 0 } }],
    inventoryBalances: [{ quantity: 100, unit: 'g', updatedAt: new Date('2026-11-17'), lastCountedAt: new Date('2026-11-17') }],
    _count: { inventoryDerivedProducts: 0, bundleIngredientFor: 0 } };
  const line = { id: 'line', productId: SALMON_STOCK.productId, quantity: 1, weightGrams: 50, variantKey: SALMON_STOCK.tierId };
  const orders: any[] = [], shipments: any[] = [], postings: any[] = [];
  const tx = { product: { findUnique: async () => product }, productPriceTier: { count: async () => 1 },
    order: { findMany: async () => orders }, shipment: { findMany: async () => shipments }, inventoryTransaction: { findMany: async () => postings } };
  const db = { $transaction: async (fn: any, options: any) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return fn(tx); } } as any;
  return { db, product, line, orders, shipments, postings };
}
test('HQ grams become sellable 50g quantities without writing or rounding up', async () => {
  const f = sourceFixture();
  assert.equal((await loadSalmonStockSource(f.db)).available, 2);
  f.product.inventoryBalances[0].quantity = 49;
  assert.equal((await loadSalmonStockSource(f.db)).available, 0);
});
test('reserve once per order including its shipments; posted grams are not deducted twice', async () => {
  const f = sourceFixture();
  f.orders.push({ id: 'o1', externalStore: domain, externalOrderId: '123', items: [f.line], shipments: [{ id: 's1' }] });
  const before = await loadSalmonStockSource(f.db);
  assert.equal(before.available, 1); assert.equal(before.outstandingGrams, 50);
  f.product.inventoryBalances[0].quantity = 50;
  f.postings.push({ id: 'p1', reference: 'shipment:s1', quantity: -50, unit: 'g', reversal: null });
  const after = await loadSalmonStockSource(f.db);
  assert.equal(after.available, 1); assert.equal(after.outstandingGrams, 0);
  assert.notEqual(before.sourceRevision, after.sourceRevision);
  f.postings[0].reversal = { quantity: 50, unit: 'g' };
  f.product.inventoryBalances[0].quantity = 100;
  assert.equal((await loadSalmonStockSource(f.db)).outstandingGrams, 50);
});
test('standalone shipment reserves grams; invalid tier and unmapped Shopify lines block', async () => {
  const f = sourceFixture();
  f.shipments.push({ id: 's1', items: [f.line] });
  assert.equal((await loadSalmonStockSource(f.db)).available, 1);
  f.line.weightGrams = 100;
  await assert.rejects(loadSalmonStockSource(f.db), /ORDER_TIER/);
  f.line.weightGrams = 50;
  f.orders.push({ id: 'o1', items: [], shopifySnapshot: { sku: SALMON_STOCK.sku } });
  await assert.rejects(loadSalmonStockSource(f.db), /UNMAPPED/);
});
test('shared recipes, uncounted or negative balance and changed SKU prevent publication', async () => {
  for (const mutate of [
    (p: any) => { p._count.bundleIngredientFor = 1; },
    (p: any) => { p.inventoryBalances[0].lastCountedAt = null; },
    (p: any) => { p.inventoryBalances[0].quantity = -1; },
    (p: any) => { p.priceTiers[0].shopifySku = 'OTHER'; },
  ]) { const f = sourceFixture(); mutate(f.product); await assert.rejects(loadSalmonStockSource(f.db)); }
});
test('order coverage requires same store, identity and quantities; missing import never replenishes', () => {
  const row = { store: domain, orderId: '123', quantity: 1 };
  assert.equal(verifyDemandCoverage([row], [{ ...row, orderId: 'gid://shopify/Order/123' }], domain), 1);
  for (const remote of [[], [{ ...row, quantity: 2 }], [{ ...row, store: 'other.myshopify.com' }], [row, row]]) {
    assert.throws(() => verifyDemandCoverage([row], remote, domain));
  }
});
const orderPayload = (next = false) => ({ data: { orders: { nodes: [{ id: 'gid://shopify/Order/123', cancelledAt: null,
  displayFinancialStatus: 'PAID', lineItems: { nodes: [{ sku: SALMON_STOCK.sku, unfulfilledQuantity: 1, variant: { id: SALMON_STOCK.variantId } }], pageInfo: { hasNextPage: false } } }],
  pageInfo: { hasNextPage: next, endCursor: next ? 'cursor1' : null } } } });
test('remote reader rejects incomplete line pages, repeated pagination, wrong variant and API errors', async () => {
  const request = (body: any) => (async () => Response.json(body)) as typeof fetch;
  assert.equal((await readSalmonOrderDemand(domain, 'test', request(orderPayload())))[0].quantity, 1);
  const lines = orderPayload(); lines.data.orders.nodes[0].lineItems.pageInfo.hasNextPage = true;
  const wrong = orderPayload(); wrong.data.orders.nodes[0].lineItems.nodes[0].variant.id = 'gid://shopify/ProductVariant/99';
  for (const body of [lines, wrong, orderPayload(true), { errors: ['failure'] }]) {
    await assert.rejects(readSalmonOrderDemand(domain, 'test', request(body)));
  }
});
function pipelineFixture() {
  const f = sourceFixture();
  const audits: any[] = []; let writes = 0, loads = 0;
  const db = { ...f.db, statusAuditLog: { findFirst: async () => null,
    create: async ({ data }: any) => { audits.push(data); return { id: 'a1' }; },
    update: async ({ data }: any) => { audits.push(data); return data; } } } as any;
  const deps = { source: async () => { loads++; return loadSalmonStockSource(f.db); }, orders: async () => [], token: async () => 'secret-test',
    write: async (plan: any, options: any) => { writes++; assert.equal(await options.verifySourceRevision(plan.sourceRevision), true); return { changed: true, before: 0, after: 2 }; } };
  return { ...f, db, deps, audits, writes: () => writes, loads: () => loads };
}
const env = { SHOPIFY_SHOP_DOMAIN: domain };
test('inspect records audit without mutation; apply rechecks source and records verified readback', async () => {
  const f = pipelineFixture();
  assert.equal((await runSalmonInventorySync(f.db, 'inspect', f.deps, env)).available, 2);
  assert.equal(f.writes(), 0); assert.equal(f.audits.at(-1).newStatus, 'INSPECTED');
  await runSalmonInventorySync(f.db, 'apply', f.deps, env);
  assert.equal(f.writes(), 1); assert.equal(f.loads(), 4);
  assert.equal(f.audits.at(-1).newStatus, 'VERIFIED');
  assert.doesNotMatch(JSON.stringify(f.audits), /secret-test/);
});
test('unimported remote order blocks before write; unknown write result persists reconciliation', async () => {
  const f = pipelineFixture();
  const deps = { ...f.deps, orders: async () => [{ store: domain, orderId: '123', quantity: 1 }] };
  await assert.rejects(runSalmonInventorySync(f.db, 'apply', deps, env), /COVERAGE_MISMATCH/);
  assert.equal(f.writes(), 0); assert.equal(f.audits.at(-1).newStatus, 'BLOCKED');
  const unknown = { ...f.deps, write: async () => { throw new Error('token=do-not-log'); } };
  await assert.rejects(runSalmonInventorySync(f.db, 'apply', unknown, env), /SYNC_FAILED/);
  assert.equal(f.audits.at(-1).newStatus, 'NEEDS_VERIFICATION');
  assert.doesNotMatch(JSON.stringify(f.audits), /do-not-log/);
});
test('unresolved write prevents the next automatic apply before loading stock', async () => {
  const f = pipelineFixture();
  f.db.statusAuditLog.findFirst = async () => ({ id: 'previous-unknown' });
  await assert.rejects(runSalmonInventorySync(f.db, 'apply', f.deps, env), /PREVIOUS_WRITE/);
  assert.equal(f.writes(), 0); assert.equal(f.loads(), 0);
});
test('new HQ demand after writing leaves a reconciliation record and never restores inventory', async () => {
  const f = pipelineFixture();
  const deps = { ...f.deps, write: async () => {
    f.orders.push({ id: 'new-order', externalStore: null, externalOrderId: null, items: [f.line], shipments: [] });
    return { changed: true, before: 0, after: 2 };
  } };
  await assert.rejects(runSalmonInventorySync(f.db, 'apply', deps, env), /POST_WRITE_SOURCE_CHANGED/);
  assert.equal(f.audits.at(-1).newStatus, 'NEEDS_VERIFICATION');
});
