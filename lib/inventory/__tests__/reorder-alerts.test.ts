import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReorderAlertSummary, type ReorderProductInput } from '../reorder-alerts';

const countedAt = new Date('2026-10-01T00:00:00.000Z');
const product = (overrides: Partial<ReorderProductInput> = {}): ReorderProductInput => ({
  id: 'p1',
  name: '鴨喉嚨',
  sku: 'FUR-0008',
  reorderPoint: 500,
  vendorName: '供應商',
  onHand: 300,
  unit: 'g',
  lastCountedAt: countedAt,
  incoming: 0,
  ...overrides,
});

test('低於補貨點且沒有足夠在途量時列為立即訂貨', () => {
  const result = buildReorderAlertSummary([product({ incoming: 100 })]);
  assert.equal(result.orderNow.length, 1);
  assert.equal(result.orderNow[0]?.projected, 400);
  assert.equal(result.orderNow[0]?.deficit, 100);
});

test('在途採購可補足時不重複列為立即訂貨', () => {
  const result = buildReorderAlertSummary([product({ incoming: 300 })]);
  assert.equal(result.orderNow.length, 0);
  assert.equal(result.incoming.length, 1);
  assert.equal(result.incoming[0]?.projected, 600);
});

test('沒有可靠盤點時間時先要求盤點，不產生採購判斷', () => {
  const result = buildReorderAlertSummary([product({ lastCountedAt: null, onHand: 0 })]);
  assert.equal(result.orderNow.length, 0);
  assert.equal(result.stocktake.length, 1);
});

test('高於補貨點的商品不顯示警訊', () => {
  const result = buildReorderAlertSummary([product({ onHand: 501 })]);
  assert.deepEqual(result, { orderNow: [], incoming: [], stocktake: [] });
});

test('缺貨商品排在低庫存商品前面', () => {
  const result = buildReorderAlertSummary([
    product({ id: 'low', name: '低庫存', onHand: 20 }),
    product({ id: 'empty', name: '已缺貨', onHand: 0 }),
  ]);
  assert.equal(result.orderNow[0]?.id, 'empty');
});

test('在途量剛好補到安全線時，不產生零缺口採購', () => {
  const result = buildReorderAlertSummary([product({ incoming: 200 })]);
  assert.equal(result.orderNow.length, 0);
  assert.equal(result.incoming[0]?.deficit, 0);
});

test('負庫存、未知單位與單位不一致需先盤點', () => {
  const result = buildReorderAlertSummary([
    product({ id: 'negative', onHand: -30 }),
    product({ id: 'unknown', unit: null }),
    product({ id: 'mismatch', unitVerified: false }),
  ]);
  assert.equal(result.orderNow.length, 0);
  assert.equal(result.stocktake.length, 3);
});

test('接單現做雞霸排除現貨採購與首次盤點待辦', () => {
  assert.deepEqual(buildReorderAlertSummary([product({ sku: 'fur-0002', lastCountedAt: null })]),
    { orderNow: [], incoming: [], stocktake: [] });
});

