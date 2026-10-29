import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planProductStockAdjustment } from '@/lib/pos/plan-stock-adjustment';

describe('planProductStockAdjustment', () => {
  it('changes only the selected tier and preserves the other tier', () => {
    const plan = planProductStockAdjustment(
      [
        { id: 'a', tierId: 't1', quantity: 2 },
        { id: 'b', tierId: 't2', quantity: 3 },
      ],
      8,
      't2',
    );
    assert.equal(plan.previousTotal, 5);
    assert.equal(plan.delta, 5);
    assert.equal(plan.nextRows.find((row) => row.id === 'b')?.quantity, 8);
    assert.equal(plan.nextRows.find((row) => row.id === 'a')?.quantity, 2);
  });

  it('rejects ambiguous totals and fractional counts', () => {
    const rows = [{ id: 'a', tierId: '30', quantity: 3 }, { id: 'b', tierId: '50', quantity: 2 }];
    assert.throws(() => planProductStockAdjustment(rows, 4), /規格/);
    assert.throws(() => planProductStockAdjustment(rows, 1.5, '30'), /不合法/);
  });

  it('rejects unchanged quantity', () => {
    assert.throws(() => planProductStockAdjustment([{ id: 'a', tierId: '', quantity: 4 }], 4));
  });
});
