import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptDate } from '../receipt-date';
import { formatPurchaseDate } from '../purchase-presentation';

test('unknown receipt date stays null and is clearly labelled', () => {
  assert.equal(parseReceiptDate('  '), null);
  assert.equal(formatPurchaseDate(null), '日期待補');
});
test('actual date survives Taiwan time conversion and invalid calendar dates fail', () => {
  assert.equal(formatPurchaseDate(parseReceiptDate('2024-02-29')), '2024-02-29');
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', 'today']) {
    assert.throws(() => parseReceiptDate(value));
  }
});
