import assert from 'node:assert/strict';
import { test } from 'node:test';
import { receiveLinkedRefillStock } from '../receive-product-stock';

function fake(links = [{ id: 'flavour-duck' }], ambiguous = false) {
  const writes: any[] = [];
  const tx = {
    $queryRaw: async () => links,
    merchant: { findUnique: async () => ({ id: 'm1', merchantId: 'MER-1', name: 'same', status: 'active' }) },
    store: {
      findUnique: async ({ select }: any) => ambiguous ? null : select.id ? { id: 's1' } : { slug: 'mer_1', name: 'same' },
      findMany: async () => [{ slug: 'one', name: 'same' }, { slug: 'two', name: 'same' }],
    },
    merchantRefillStock: { upsert: async (args: any) => { writes.push(args); return { quantity: 7 }; } },
    refillStockTxn: { create: async (args: any) => { writes.push(args); } },
  };
  return { tx: tx as never, writes };
}
const input = { merchantId: 'm1', productId: 'duck', quantity: 2, shipmentNumber: 'SHP-1' };
test('receipt mirrors the same jars to the exact merchant store and writes stock audit only', async () => {
  const { tx, writes } = fake();
  await receiveLinkedRefillStock(tx, input);
  assert.deepEqual(writes[0].where, { storeId_flavourId: { storeId: 's1', flavourId: 'flavour-duck' } });
  assert.deepEqual(writes[0].update, { quantity: { increment: 2 } });
  assert.equal(writes[1].data.quantityAfter, 7);
  assert.equal(writes[1].data.changeQty, 2);
  assert.equal(writes[1].data.reason, 'restock');
});
test('unlinked legacy jars do not invent a flavour or stock', async () => {
  const { tx, writes } = fake([]);
  await receiveLinkedRefillStock(tx, input);
  assert.equal(writes.length, 0);
});
test('ambiguous same-name stores fail before any refill write', async () => {
  const { tx, writes } = fake(undefined, true);
  await assert.rejects(receiveLinkedRefillStock(tx, input), /尚未設定/);
  assert.equal(writes.length, 0);
});
test('ambiguous product links fail before any refill write', async () => {
  const { tx, writes } = fake([{ id: 'one' }, { id: 'two' }]);
  await assert.rejects(receiveLinkedRefillStock(tx, input), /多個口味/);
  assert.equal(writes.length, 0);
});
