import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stockStatus, suggestedRestockQty } from '@/lib/pos/stock-status';

describe('stockStatus', () => {
  it('uses 已售完 / 快沒了 / 庫存正常', () => {
    assert.equal(stockStatus(0).label, '已售完');
    assert.equal(stockStatus(2).label, '快沒了');
    assert.equal(stockStatus(8).label, '庫存正常');
  });
});

describe('suggestedRestockQty', () => {
  it('fills up to 6', () => {
    assert.equal(suggestedRestockQty(0), 6);
    assert.equal(suggestedRestockQty(2), 4);
    assert.equal(suggestedRestockQty(8), 0);
  });
});
