import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStockMovementReason } from '@/lib/merchant-stock-movement';

test('decreasing stock can be recorded as a count correction', () => {
  const reason = resolveStockMovementReason(-1, 'count_correction');

  assert.equal(reason.value, 'count_correction');
  assert.equal(reason.txnType, 'adjust');
  assert.equal(reason.countsAsSale, false);
});

test('decreasing stock still defaults to a sale for old forms', () => {
  const reason = resolveStockMovementReason(-1, '');

  assert.equal(reason.value, 'sale');
  assert.equal(reason.countsAsSale, true);
});
