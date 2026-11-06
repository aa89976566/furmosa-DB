import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { Prisma } from '@prisma/client';
import { deductCountedRefillProductStock, deductLinkedRefillProductStock } from '../counted-product-stock';

function fixture(quantity = 5, conflict = false) {
  const ledger: any[] = [];
  const updates: any[] = [];
  return {
    ledger, updates,
    tx: {
      merchantStock: {
        findMany: async (args: any) => {
          assert.equal(args.where.merchantId, 'manlisa');
          assert.equal(args.where.productId, 'mixed');
          return [{ id: 'stock', quantity, tierId: 'jar' }];
        },
        updateMany: async (args: any) => { updates.push(args); return { count: conflict ? 0 : 1 }; },
      },
      merchantStockTxn: { create: async (args: any) => { ledger.push(args.data); } },
    } as unknown as Prisma.TransactionClient,
  };
}
const delivery = { merchantId: 'manlisa', productId: 'mixed', quantity: 1, orderId: 'paid-refill' };
it('one jar delivery mirrors five to four without duplicating revenue', async () => {
  const f = fixture();
  await deductCountedRefillProductStock(f.tx, delivery);
  assert.equal(f.updates[0].data.quantity.decrement, 1);
  assert.equal(f.updates[0].where.quantity, 5);
  assert.equal(f.ledger[0].balanceAfter, 4);
  assert.equal(f.ledger[0].companyRevenue, 0);
  assert.equal(f.ledger[0].settlementQuantity, 0);
});
it('rejects insufficient matching product stock before writing', async () => {
  const f = fixture(0);
  await assert.rejects(deductCountedRefillProductStock(f.tx, delivery), /庫存不一致/);
  assert.equal(f.updates.length, 0);
  assert.equal(f.ledger.length, 0);
});
it('rejects concurrent count changes without writing a duplicate ledger', async () => {
  const f = fixture(5, true);
  await assert.rejects(deductCountedRefillProductStock(f.tx, delivery), /已變動/);
  assert.equal(f.ledger.length, 0);
});

it('a linked 20g beef jar also mirrors POS inventory from two to one', async () => {
  const f = fixture(2);
  Object.assign(f.tx, { $queryRaw: async () => [{ product_id: 'mixed' }] });
  await deductLinkedRefillProductStock(f.tx, {
    merchantId: 'manlisa', flavourId: 'beef', weightGrams: 20, quantity: 1, orderId: 'paid-beef',
  });
  assert.equal(f.updates[0].data.quantity.decrement, 1);
  assert.equal(f.ledger[0].balanceAfter, 1);
  assert.equal(f.ledger[0].companyRevenue, 0);
});
it('preserves legacy refill-only stores with no tracked product stock', async () => {
  const f = fixture();
  Object.assign(f.tx.merchantStock, { findMany: async () => [] });
  await deductCountedRefillProductStock(f.tx, { ...delivery, allowUntrackedStock: true });
  assert.equal(f.updates.length, 0);
});
it('an existing zero stock is not treated as an untracked legacy store', async () => {
  const f = fixture(0);
  await assert.rejects(deductCountedRefillProductStock(f.tx, { ...delivery, allowUntrackedStock: true }), /庫存不一致/);
  assert.equal(f.updates.length, 0);
});
