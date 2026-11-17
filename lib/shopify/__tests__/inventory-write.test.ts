import assert from 'node:assert/strict';
import test from 'node:test';
import { writeVerifiedInventory, type InventoryWritePlan } from '../inventory-write.ts';
const plan: InventoryWritePlan = { variantId: 'gid://shopify/ProductVariant/1', inventoryItemId: 'gid://shopify/InventoryItem/2',
  locationId: 'gid://shopify/Location/3', sku: 'FUR-SALMON-SKIN-50', warehouseCode: 'WH-MAIN',
  available: 0, issues: [], snapshotComplete: true, sourceRevision: 'a'.repeat(64), observedAt: '2026-11-17T12:00:00Z' };
const level = (id: string, available: number, committed = 0) => ({ location: { id }, quantities: [{ name: 'available', quantity: available }, { name: 'committed', quantity: committed }] });
function read(available: number, other = 0, policy = 'DENY', tracked = true) { return { data: { productVariant: {
  id: plan.variantId, sku: plan.sku, inventoryPolicy: policy, inventoryItem: { id: plan.inventoryItemId, tracked,
    inventoryLevels: { nodes: [level(plan.locationId, available), level('gid://shopify/Location/4', other)], pageInfo: { hasNextPage: false } } },
} } }; }
const written = { data: { inventorySetQuantities: { userErrors: [], inventoryAdjustmentGroup: { referenceDocumentUri: `hq://inventory/${plan.sourceRevision}` } } } };
function fixture(responses: unknown[], verified = true) {
  const calls: any[] = [];
  const deps = { domain: 'example.myshopify.com', token: 'test', now: () => Date.parse(plan.observedAt) + 1000,
    verifySourceRevision: async () => verified,
    request: (async (_url: unknown, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      const next = responses.shift(); assert.notEqual(next, undefined);
      return Response.json(next);
    }) as typeof fetch };
  return { deps, calls };
}
test('sold-out write uses explicit location, CAS, required idempotency and readback', async () => {
  const { deps, calls } = fixture([read(2), written, read(0)]);
  assert.deepEqual(await writeVerifiedInventory(plan, deps), { changed: true, before: 2, after: 0 });
  assert.deepEqual(calls[1].variables.input.quantities, [{ inventoryItemId: plan.inventoryItemId, locationId: plan.locationId, quantity: 0, changeFromQuantity: 2 }]);
  assert.match(calls[1].query, /@idempotent/);
  assert.match(calls[1].variables.idempotencyKey, /^[a-f0-9]{64}$/);
});
test('same validated plan uses same key; already-applied state does not write again', async () => {
  const one = fixture([read(2), written, read(0)]), two = fixture([read(2), written, read(0)]);
  await writeVerifiedInventory(plan, one.deps); await writeVerifiedInventory(plan, two.deps);
  assert.equal(one.calls[1].variables.idempotencyKey, two.calls[1].variables.idempotencyKey);
  const noOp = fixture([read(0)]);
  assert.equal((await writeVerifiedInventory(plan, noOp.deps)).changed, false);
  assert.equal(noOp.calls.length, 1);
});
test('unknown HQ source, stale snapshot and invalid quantities never read or write Shopify', async () => {
  for (const patch of [{ snapshotComplete: false }, { available: null }, { available: -1 }, { available: 1.5 }, { issues: ['UNKNOWN'] }, { observedAt: '2020-01-01' }]) {
    const f = fixture([]);
    await assert.rejects(writeVerifiedInventory({ ...plan, ...patch }, f.deps));
    assert.equal(f.calls.length, 0);
  }
});
test('a changed HQ revision after remote read blocks the mutation', async () => {
  const f = fixture([read(2)], false);
  await assert.rejects(writeVerifiedInventory(plan, f.deps), /SOURCE_CHANGED/);
  assert.equal(f.calls.length, 1);
});
test('unknown location, SKU mismatch, untracked stock, continue selling or other-location stock block', async () => {
  const wrongSku = read(2); wrongSku.data.productVariant.sku = 'OTHER';
  const paginated = read(2); paginated.data.productVariant.inventoryItem.inventoryLevels.pageInfo.hasNextPage = true;
  const wrongLocation = read(2); wrongLocation.data.productVariant.inventoryItem.inventoryLevels.nodes[0].location.id = 'gid://shopify/Location/9';
  for (const payload of [wrongSku, paginated, wrongLocation, read(2, 1), read(2, 0, 'CONTINUE'), read(2, 0, 'DENY', false)]) {
    const f = fixture([payload]);
    await assert.rejects(writeVerifiedInventory(plan, f.deps)); assert.equal(f.calls.length, 1);
  }
});
test('concurrent Shopify order rejects CAS without forced overwrite or automatic retry', async () => {
  const f = fixture([read(2), { data: { inventorySetQuantities: { userErrors: [{ code: 'CHANGE_FROM_QUANTITY_STALE' }], inventoryAdjustmentGroup: null } } }]);
  await assert.rejects(writeVerifiedInventory(plan, f.deps), /WRITE_REJECTED/);
  assert.equal(f.calls.length, 2);
});
test('intervening order during readback requests reconciliation instead of restoring old stock', async () => {
  const f = fixture([read(2), written, read(-1)]);
  await assert.rejects(writeVerifiedInventory(plan, f.deps), /READBACK_CHANGED/);
  assert.equal(f.calls.length, 3);
});
