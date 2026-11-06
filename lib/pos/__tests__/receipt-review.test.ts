import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadReceiptReviewIds, receiptOverlapsStockCount } from '../receipt-review';

const shipment = { id: 's1', shipmentNumber: 'SHP-1', createdAt: new Date('2026-01-01'), shippedAt: new Date('2026-01-02'), items: [{ id: 'i1', productId: 'p1', quantity: 2 }] };
test('a physical count after shipment requires review; old counts and other products do not', () => {
  assert.equal(receiptOverlapsStockCount(shipment, [{ productId: 'p1', lastCountAt: new Date('2026-02-01') }]), true);
  assert.equal(receiptOverlapsStockCount(shipment, [{ productId: 'p1', lastCountAt: new Date('2025-12-01') }]), false);
  assert.equal(receiptOverlapsStockCount(shipment, [{ productId: 'p2', lastCountAt: new Date('2026-02-01') }]), false);
});
test('missing dispatch time uses creation as conservative review boundary', () => {
  assert.equal(receiptOverlapsStockCount({ ...shipment, shippedAt: null }, [{ productId: 'p1', lastCountAt: new Date('2026-01-02') }]), true);
});
function fake(posted: boolean, counted: boolean) {
  const reads: any[] = [];
  return { reads, db: {
    shipment: { findMany: async (args: any) => { reads.push(args.where); return [shipment]; } },
    merchantStockTxn: { findMany: async (args: any) => args.where.shipmentItemId && posted ? [{ shipmentItemId: 'i1' }] : [] },
    merchantStock: { findMany: async () => counted ? [{ productId: 'p1', lastCountAt: new Date('2026-02-01') }] : [] },
  } as never };
}
test('posted or later-counted shipments are not actionable reminders; genuinely new shipments remain actionable', async () => {
  for (const [posted, counted] of [[true, false], [false, true], [false, false]]) {
    const { db, reads } = fake(posted, counted);
    assert.equal((await loadReceiptReviewIds('m1', ['s1'], db)).has('s1'), posted || counted);
    assert.equal(reads[0].merchantId, 'm1');
    assert.equal(reads[0].type, 'merchant_restock');
  }
});
test('unavailable evidence stops POS reminders but cannot authorize HQ closure', async () => {
  const db = { shipment: { findMany: async () => { throw new Error('offline'); } } } as never;
  assert.equal((await loadReceiptReviewIds('m1', ['s1'], db)).has('s1'), true);
  await assert.rejects(loadReceiptReviewIds('m1', ['s1'], db, true), /暫時無法讀取/);
});
