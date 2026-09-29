import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { allPurchaseLinesConfirmed, purchaseOrderIsDue } from '../inventory/purchase-orders';
import { applyStocktake } from '../inventory/stocktake';
import { receiptAverageCost } from '../inventory/purchase-cost';
import { purchaseReceiptEventKey } from '../inventory/post-purchase-receipt';

test('採購提醒依台灣日曆日在 11/1 零點開始', () => {
  const reminder = new Date('2026-11-01T00:00:00+08:00');
  assert.equal(purchaseOrderIsDue(reminder, new Date('2026-10-31T15:59:59.999Z')), false);
  assert.equal(purchaseOrderIsDue(reminder, new Date('2026-10-31T16:00:00.000Z')), true);
});

test('負庫存補到零或正數才允許收貨', () => {
  assert.deepEqual(receiptAverageCost({ previousStockGrams: -20, previousAverageCostPerGram: 1, receivedGrams: 20, landedAmountCents: 2000 }), { resultingStockGrams: 0, averageCostPerGram: 0 });
  assert.equal(receiptAverageCost({ previousStockGrams: -20, previousAverageCostPerGram: 1, receivedGrams: 30, landedAmountCents: 5000 }).resultingStockGrams, 10);
  assert.throws(() => receiptAverageCost({ previousStockGrams: -20, previousAverageCostPerGram: 1, receivedGrams: 19, landedAmountCents: 5000 }), /入庫後仍為 -1g/);
});

test('伺服器必須收到每個真實採購行 ID，不能偽造數量繞過', () => {
  assert.equal(allPurchaseLinesConfirmed(['a', 'b'], ['a', 'b']), true);
  assert.equal(allPurchaseLinesConfirmed(['a', 'b'], ['a']), false);
  assert.equal(allPurchaseLinesConfirmed(['a', 'b'], ['x', 'y']), false);
  assert.equal(allPurchaseLinesConfirmed(['a', 'b'], ['a', 'a']), false);
});

test('每個採購行使用固定入庫事件鍵', () => {
  assert.equal(purchaseReceiptEventKey('po-1', 'line-2'), 'purchase-order:po-1:line-2');
});

test('盤點精確保存 300g、NT$420 與前後差額', async () => {
  let created: Record<string, unknown> | undefined;
  const tx = {
    stocktakeAdjustment: { findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: 'adj-1', ...data }; } },
    product: { findUnique: async () => ({ id: 'p1', name: '豬蛋蛋', averageCostPerGram: new Prisma.Decimal('1.8') }), update: async () => ({}) },
    inventoryBalance: { findMany: async () => [{ warehouseId: 'w1', quantity: -210, unit: 'g' }], upsert: async () => ({}) },
    inventoryTransaction: { create: async () => ({ id: 'txn-1' }) },
  };
  const db = { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) };
  const result = await applyStocktake(db as never, { eventKey: 'pig-balls-20260929', productId: 'p1', warehouseId: 'w1', afterQuantity: 300, afterTotalCostCents: 42000, reason: '實體盤點', createdById: 'u1' });
  assert.equal(result.alreadyApplied, false);
  assert.equal(created?.beforeQuantity, -210);
  assert.equal(created?.afterQuantity, 300);
  assert.equal(created?.deltaQuantity, 510);
  assert.equal(String(created?.afterTotalCost), '420');
  assert.equal(String(created?.beforeTotalCost), '-378');
  assert.equal(String(created?.deltaTotalCost), '798');
});

test('相同盤點識別碼重送時不建立第二筆異動', async () => {
  let movementCalls = 0;
  const existing = {
    id: 'adj-existing',
    eventKey: 'same',
    productId: 'p1',
    warehouseId: 'w1',
    afterQuantity: 300,
    afterTotalCost: new Prisma.Decimal('420'),
    reason: '實體盤點',
  };
  const tx = { stocktakeAdjustment: { findUnique: async () => existing }, inventoryTransaction: { create: async () => { movementCalls += 1; } } };
  const db = { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) };
  const result = await applyStocktake(db as never, { eventKey: 'same', productId: 'p1', warehouseId: 'w1', afterQuantity: 300, afterTotalCostCents: 42000, reason: '實體盤點', createdById: 'u1' });
  assert.equal(result.alreadyApplied, true);
  assert.equal(movementCalls, 0);
});

test('相同盤點識別碼不能靜默接受不同盤點內容', async () => {
  const existing = {
    id: 'adj-existing',
    eventKey: 'same',
    productId: 'p1',
    warehouseId: 'w1',
    afterQuantity: 300,
    afterTotalCost: new Prisma.Decimal('420'),
    reason: '實體盤點',
  };
  const tx = { stocktakeAdjustment: { findUnique: async () => existing } };
  const db = { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) };
  await assert.rejects(
    applyStocktake(db as never, { eventKey: 'same', productId: 'p1', warehouseId: 'w1', afterQuantity: 301, afterTotalCostCents: 42000, reason: '實體盤點', createdById: 'u1' }),
    /已用於不同內容/,
  );
});
