import assert from 'node:assert/strict';
import test from 'node:test';
import { currentTaipeiMonth, parseTaipeiSettlementMonth } from '../vendor-settlement-period';

test('台灣 10 月使用本地月初到下個月月初，不受伺服器時區影響', () => {
  assert.deepEqual(parseTaipeiSettlementMonth('2026-10'), {
    periodStart: new Date('2026-09-30T16:00:00.000Z'),
    periodEnd: new Date('2026-10-31T16:00:00.000Z'),
  });
});

test('台灣跨日後顯示正確月份', () => {
  assert.equal(currentTaipeiMonth(new Date('2026-10-31T16:30:00.000Z')), '2026-11');
});

test('拒絕不完整或超出範圍的月份', () => {
  assert.throws(() => parseTaipeiSettlementMonth('2026-1'));
  assert.throws(() => parseTaipeiSettlementMonth('2019-12'));
});
