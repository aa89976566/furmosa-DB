import assert from 'node:assert/strict';
import test from 'node:test';
import { previewHqPacks, type HqPackTier } from '../hq-pack-preview.ts';
import { loadHqPackPreview } from '../load-hq-pack-preview.ts';

const tier: HqPackTier = { id: 'salmon-50', productId: 'salmon', weightGrams: 50,
  shopifyVariantId: '64882303271289', inventoryPolicy: 'shared',
  product: { inventorySourceProductId: null }, bundleComponents: [] };
const balance = { productId: 'salmon', quantity: 100, unit: 'g' };

test('reports two packs as stock capacity, never as publishable inventory without reservations', () => {
  const [row] = previewHqPacks([tier], [balance]);
  assert.equal(row.stockCapacityBeforeReservations, 2);
  assert.equal(row.available, null);
  assert.ok(row.issues.includes('RESERVATION_COVERAGE_NOT_VERIFIED'));
});
test('reads explicit recipe and source product; rejects a mismatched recipe', () => {
  const bundle = { ...tier, weightGrams: 45, bundleComponents: ['a', 'b', 'c'].map(componentProductId => ({ componentProductId, gramsPerPack: 15 })) };
  const balances = ['a', 'b', 'c'].map((productId, i) => ({ productId, quantity: [100, 44, 100][i], unit: '克' }));
  assert.equal(previewHqPacks([bundle], balances)[0].stockCapacityBeforeReservations, 2);
  assert.equal(previewHqPacks([{ ...bundle, weightGrams: 50 }], balances)[0].stockCapacityBeforeReservations, null);
  assert.equal(previewHqPacks([{ ...tier, productId: 'jar', product: { inventorySourceProductId: 'salmon' } }], [balance])[0].stockCapacityBeforeReservations, 2);
});
test('unbound HQ tiers also block duplicate allocation of a shared ingredient', () => {
  const other = { ...tier, id: 'salmon-100', weightGrams: 100, shopifyVariantId: null };
  const rows = previewHqPacks([tier, other], [balance]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stockCapacityBeforeReservations, null);
  assert.ok(rows[0].issues.includes('SHARED_POOL_REQUIRES_ALLOCATION'));
});
test('missing counts and independent inventory cannot masquerade as bulk grams', () => {
  assert.equal(previewHqPacks([tier], [])[0].stockCapacityBeforeReservations, null);
  assert.equal(previewHqPacks([tier], [{ ...balance, unit: null }])[0].stockCapacityBeforeReservations, null);
  assert.equal(previewHqPacks([{ ...tier, inventoryPolicy: 'independent' }], [balance])[0].stockCapacityBeforeReservations, null);
});

test('loader pins one warehouse and one repeatable snapshot; missing warehouse stops reads', async () => {
  let found = true;
  let reads = 0;
  const db = {
    $transaction: async (callback: (tx: unknown) => unknown, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 15000 });
      return callback({
        warehouse: { findUnique: async (args: unknown) => {
          assert.deepEqual(args, { where: { code: 'WH-MAIN' }, select: { id: true, code: true } });
          return found ? { id: 'main', code: 'WH-MAIN' } : null;
        } },
        productPriceTier: { findMany: async () => { reads++; return [tier]; } },
        inventoryBalance: { findMany: async (args: unknown) => {
          assert.deepEqual(args, { where: { warehouseId: 'main', productId: { in: ['salmon'] } },
            select: { productId: true, quantity: true, unit: true } });
          return [balance];
        } },
      });
    },
  } as unknown as Parameters<typeof loadHqPackPreview>[0];
  const report = await loadHqPackPreview(db, 'WH-MAIN');
  assert.equal(report.publicationEnabled, false);
  assert.equal(report.rows[0].stockCapacityBeforeReservations, 2);
  assert.equal(report.rows[0].available, null);
  found = false;
  await assert.rejects(loadHqPackPreview(db, 'WH-MAIN'), /WAREHOUSE_NOT_FOUND/);
  assert.equal(reads, 1);
  await assert.rejects(loadHqPackPreview(db, ''), /WAREHOUSE_REQUIRED/);
});
