import assert from 'node:assert/strict';
import test from 'node:test';
import { archivablePendingOrderWhere, taiwanWeekStart } from '../archive-policy';
import { isHistoricalOrder } from '../../order-list';

test('台灣週起點固定為星期一零時', () => {
  const result = taiwanWeekStart(new Date('2026-09-16T12:00:00.000Z'));
  assert.equal(result.toISOString(), '2026-09-13T16:00:00.000Z');
});

test('舊訂單封存條件不包含刪除、已封存或已進入後續流程的訂單', () => {
  const before = new Date('2026-09-13T16:00:00.000Z');
  assert.deepEqual(archivablePendingOrderWhere(before), {
    deletedAt: null,
    archivedAt: null,
    status: 'pending_review',
    OR: [{ omsStatus: null }, { omsStatus: { in: ['NEW', 'REVIEW'] } }],
    orderedAt: { lt: before },
  });
});

test('封存不需要偽裝成取消或退貨，也會列入歷史訂單', () => {
  assert.equal(isHistoricalOrder({ status: 'pending_review', fulfillmentStatus: 'pending', archivedAt: new Date() }), true);
  assert.equal(isHistoricalOrder({ status: 'pending_review', fulfillmentStatus: 'pending', archivedAt: null }), false);
});
