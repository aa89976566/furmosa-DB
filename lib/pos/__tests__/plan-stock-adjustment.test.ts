import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planProductStockAdjustment } from '@/lib/pos/plan-stock-adjustment';

describe('planProductStockAdjustment', () => {
  it('puts the new total on the largest row and zeros the rest', () => {
    const plan = planProductStockAdjustment(
      [
        { id: 'a', tierId: 't1', quantity: 2 },
        { id: 'b', tierId: 't2', quantity: 3 },
      ],
      8,
    );
    assert.equal(plan.previousTotal, 5);
    assert.equal(plan.delta, 3);
    assert.equal(plan.nextRows.find((row) => row.id === 'b')?.quantity, 8);
    assert.equal(plan.nextRows.find((row) => row.id === 'a')?.quantity, 0);
  });

  it('rejects unchanged quantity', () => {
    assert.throws(() => planProductStockAdjustment([{ id: 'a', tierId: '', quantity: 4 }], 4));
  });
});
