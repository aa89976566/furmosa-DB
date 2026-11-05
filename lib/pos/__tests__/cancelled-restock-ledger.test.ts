import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '@/lib/prisma';
import { loadStoreLedger } from '@/lib/pos/load-store-ledger';

test('cancelled shipment is absent from settlement pending while valid unpriced restock remains', async (t) => {
  const at = new Date('2026-11-05T12:00:00Z');
  const restock = (id: string, status: string) => ({
    id, approvedAt: at, createdAt: at,
    shipment: { status, shipmentNumber: `S-${id}`, order: { orderNumber: `O-${id}` } },
    items: [{ requestedQuantity: 1, approvedQuantity: 1, product: { name: '測試商品', cost: 99 } }],
  });
  const replace = (model: object, key: string, fn: (...args: any[]) => Promise<any>) => {
    const target = model as Record<string, any>;
    const original = target[key];
    target[key] = fn;
    t.after(() => { target[key] = original; });
  };
  replace(prisma.store, 'findUnique', async () => null);
  for (const model of [prisma.refillOrder, prisma.groomingCoupon, prisma.rewardRedemption, prisma.merchantStockTxn]) {
    replace(model, 'findMany', async () => []);
  }
  let query: any;
  replace(prisma.restockRequest, 'findMany', async (args) => {
    query = args;
    return [restock('cancelled', 'cancelled'), restock('active', 'shipped')];
  });
  const result = await loadStoreLedger({
    merchantId: 'merchant-ci', periodStart: new Date('2026-11-01T00:00:00Z'), periodEnd: new Date('2026-11-07T00:00:00Z'),
  }, Promise.resolve({ id: 'merchant-ci', merchantId: 'CI', name: '測試店', city: null, phone: null, address: null, contactName: null }));
  assert.deepEqual(result.pending.map((row) => row.sourceRef), ['active']);
  assert.equal(result.pending[0].reason, 'RESTOCK_NO_TRUSTED_PRICE');
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].amount, 0);
  assert.equal(result.sources.length, 0);
  assert.equal(query.select.shipment.select.status, true);
});
