import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planProductStockAdjustment } from '@/lib/pos/plan-stock-adjustment';

describe('planProductStockAdjustment', () => {
  it('rejects mixed tiers instead of moving all stock into one specification', () => {
    assert.throws(() => planProductStockAdjustment([
      { id: 'a', tierId: '30g', quantity: 2 }, { id: 'b', tierId: '50g', quantity: 3 },
    ], 8), /多種規格/);
  });
  it('updates a single tier and rejects fractional counts', () => {
    const rows = [{id:'a',tierId:'30g',quantity:2}];
    assert.deepEqual(planProductStockAdjustment(rows, 4), {previousTotal:2,delta:2,nextRows:[{...rows[0],quantity:4}]});
    assert.throws(() => planProductStockAdjustment(rows, 2.5), /不合法/);
  });

  it('rejects unchanged quantity', () => {
    assert.throws(() => planProductStockAdjustment([{ id: 'a', tierId: '', quantity: 4 }], 4));
  });
});
