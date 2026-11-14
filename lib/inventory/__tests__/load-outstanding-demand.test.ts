import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOutstandingDemand } from '../load-outstanding-demand';

function fixture({ overflow = false, blocked = false } = {}) {
  const item = { quantity: 2, weightGrams: 50, variantKey: 't', product: { id: 'salmon', sku: 'FUR-0129', unit: 'g',
    category: 'treats', inventorySourceProductId: null, priceTiers: [{ id: 't', weightGrams: 50, unit: 'g', unitQty: 1, bundleComponents: [] }] } };
  const db = { $transaction: async (run: (tx: unknown) => unknown, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 15000 });
    return run({
      order: { findMany: async (args: any) => {
        assert.equal(args.take, 1001);
        assert.deepEqual(args.where.fulfillmentStatus.in, ['pending', 'packed']);
        assert.equal(args.where.status.not, 'cancelled');
        assert.equal(args.where.paymentStatus.not, 'refunded');
        return Array.from({ length: overflow ? 1001 : 1 }, (_, i) => ({ id: `o${i}`, externalOrderId: 'external',
          omsIssueFlags: blocked ? [{ blocking: true }] : [], items: [item], shipments: [{ id: 's1' }] }));
      } },
      shipment: { findMany: async (args: any) => {
        assert.equal(args.where.orderId, null);
        return [];
      } },
      inventoryTransaction: { findMany: async (args: any) => {
        assert.equal(args.where.warehouse.code, 'WH-MAIN');
        assert.equal(args.where.type, 'sales_out');
        assert.deepEqual(args.where.reference.in.slice(0, 2), ['order:o0', 'shipment:s1']);
        return [{ reference: 'shipment:s1', productId: 'salmon', quantity: -50, reversal: null }];
      } },
    });
  } } as unknown as Parameters<typeof loadOutstandingDemand>[0];
  return db;
}

test('loader combines linked shipment postings with order demand without reading linked shipments twice', async () => {
  const result = await loadOutstandingDemand(fixture());
  assert.equal(result.complete, true);
  assert.equal(result.reserved.get('salmon'), 50);
});
test('query overflow and unresolved Shopify mapping cannot be treated as complete coverage', async () => {
  assert.equal((await loadOutstandingDemand(fixture({ overflow: true }))).complete, false);
  assert.equal((await loadOutstandingDemand(fixture({ blocked: true }))).complete, false);
});
