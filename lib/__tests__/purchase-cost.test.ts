import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateCommonCost, movingAverageCost, parseMoneyToCents } from '../inventory/purchase-cost';

describe('purchase receipt costing', () => {
  it('parses TWD without floating-point money drift', () => {
    assert.equal(parseMoneyToCents('1400', '金額'), 140000);
    assert.equal(parseMoneyToCents('12.5', '金額'), 1250);
    assert.throws(() => parseMoneyToCents('1.234', '金額'));
  });

  it('allocates every cent and preserves line order', () => {
    const lines = [
      { productId: 'a', quantityGrams: 500, rawAmountCents: 140000 },
      { productId: 'b', quantityGrams: 2000, rawAmountCents: 360000 },
      { productId: 'c', quantityGrams: 1000, rawAmountCents: 150000 },
      { productId: 'd', quantityGrams: 1000, rawAmountCents: 100000 },
    ];
    const allocated = allocateCommonCost(lines, 30000);
    assert.equal(allocated.reduce((sum, cents) => sum + cents, 0), 30000);
    assert.deepEqual(allocated, [5600, 14400, 6000, 4000]);
  });

  it('calculates a moving weighted average instead of replacing the old cost', () => {
    assert.equal(movingAverageCost({
      previousStockGrams: 1000,
      previousAverageCostPerGram: 2,
      receivedGrams: 500,
      landedAmountCents: 150000,
    }), 2.3333333333333335);
  });
});
