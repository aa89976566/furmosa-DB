import assert from 'node:assert/strict';
import test from 'node:test';
import { EXCLUSIVE_STOCK_TARGETS, runExclusiveStockBatch } from '../exclusive-stock-batch.ts';
import { loadSalmonStockSource } from '../salmon-stock-source.ts';
import { readSalmonOrderDemand } from '../salmon-order-demand.ts';

const stock = EXCLUSIVE_STOCK_TARGETS[0];
function fixture() {
  const product = { id: stock.productId, unit: 'g', status: 'active', productCategory: 'STANDARD', inventorySourceProductId: null,
    priceTiers: [{ id: stock.tierId, weightGrams: 40, unit: 'g', unitQty: 1, shopifySku: stock.sku,
      shopifyVariantId: stock.variantId.split('/').at(-1), inventoryPolicy: 'shared', _count: { bundleComponents: 0 } }],
    inventoryBalances: [{ quantity: 120, unit: 'g', updatedAt: new Date(), lastCountedAt: new Date() }],
    _count: { inventoryDerivedProducts: 0, bundleIngredientFor: 0 } };
  const orders: any[] = [], postings: any[] = [];
  const tx = { product: { findUnique: async ({ where }: any) => { assert.equal(where.id, stock.productId); return product; } },
    productPriceTier: { count: async ({ where }: any) => { assert.equal(where.OR[1].shopifySku.equals, stock.sku); return 1; } },
    order: { findMany: async () => orders }, shipment: { findMany: async () => [] }, inventoryTransaction: { findMany: async () => postings } };
  return { product, orders, postings, db: { $transaction: async (fn: any) => fn(tx) } as any };
}
test('40g source uses its own tier and identity, floors stock and releases only posted grams', async () => {
  const f = fixture();
  assert.equal((await loadSalmonStockSource(f.db, stock)).available, 3);
  f.orders.push({ id: 'o', externalOrderId: null, externalStore: null, shipments: [], items: [{ productId: stock.productId,
    quantity: 1, weightGrams: 40, variantKey: stock.tierId }] });
  assert.equal((await loadSalmonStockSource(f.db, stock)).available, 2);
  f.product.inventoryBalances[0].quantity = 80;
  f.postings.push({ reference: 'order:o', quantity: -40, unit: 'g', reversal: null });
  assert.equal((await loadSalmonStockSource(f.db, stock)).available, 2);
  f.product.inventoryBalances[0].quantity = 39;
  assert.equal((await loadSalmonStockSource(f.db, stock)).available, 0);
  f.product.priceTiers[0].weightGrams = 50;
  await assert.rejects(loadSalmonStockSource(f.db, stock), /BINDING_CHANGED/);
});
test('40g remote scan uses target SKU and refuses the same SKU under a different variant', async () => {
  const payload = { data: { orders: { nodes: [{ id: 'gid://shopify/Order/123', cancelledAt: null,
    displayFinancialStatus: 'PAID', lineItems: { nodes: [{ sku: stock.sku, unfulfilledQuantity: 1, variant: { id: stock.variantId } }],
      pageInfo: { hasNextPage: false } } }], pageInfo: { hasNextPage: false } } } };
  const request = (async (_url: unknown, options: any) => {
    const query = JSON.parse(options.body).query;
    assert.ok(query.includes(`sku:${stock.sku} -status:cancelled`));
    assert.ok(!query.includes('sku:FUR-SALMON-SKIN-50'));
    return Response.json(payload);
  }) as typeof fetch;
  assert.equal((await readSalmonOrderDemand('example.myshopify.com', 'test', request, stock))[0].quantity, 1);
  payload.data.orders.nodes[0].lineItems.nodes[0].variant.id = 'gid://shopify/ProductVariant/99';
  await assert.rejects(readSalmonOrderDemand('example.myshopify.com', 'test', request, stock), /BINDING_CHANGED/);
});
test('bounded batch isolates a blocked SKU, stays sequential and sanitizes failures', async () => {
  const seen: string[] = []; let active = 0;
  const run = (async (_db: unknown, mode: string, target: typeof stock) => {
    assert.equal(mode, 'inspect'); assert.equal(active++, 0);
    await Promise.resolve(); active--; seen.push(target.sku);
    if (target.sku === EXCLUSIVE_STOCK_TARGETS[1].sku) throw new Error('private-token-not-logged');
    return {};
  }) as any;
  const result = await runExclusiveStockBatch({} as any, 'inspect', { NODE_ENV: 'test' }, run);
  assert.equal(seen.length, 10); assert.equal(result.blocked, 1);
  assert.equal(result.results.at(-1)?.status, 'inspected');
  assert.doesNotMatch(JSON.stringify(result), /private-token/);
  assert.equal(new Set(EXCLUSIVE_STOCK_TARGETS.map(t => t.productId)).size, 10);
  assert.equal(new Set(EXCLUSIVE_STOCK_TARGETS.map(t => t.variantId)).size, 10);
  assert.ok(EXCLUSIVE_STOCK_TARGETS.every(t => t.gramsPerItem === 40 && t.sku.startsWith('QIQI-')));
});
