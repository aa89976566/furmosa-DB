import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveGiftWeightCost } from '../../order-item-cost';

describe('自訂克數贈品成本', () => {
  it('依 Shopify 規格成本換算實際贈送克數', () => {
    assert.equal(resolveGiftWeightCost({
      tierCost: 60,
      tierWeightGrams: 30,
      giftWeightGrams: 12,
    }), 24);
  });

  it('保留到小數二位，供訂單記錄公司贈品成本', () => {
    assert.equal(resolveGiftWeightCost({
      tierCost: 50,
      tierWeightGrams: 30,
      giftWeightGrams: 7,
    }), 11.67);
  });

  it('拒絕沒有克數或成本依據的規格', () => {
    assert.throws(() => resolveGiftWeightCost({
      tierCost: null,
      tierWeightGrams: 30,
      giftWeightGrams: 10,
    }), /克數與成本/);
    assert.throws(() => resolveGiftWeightCost({
      tierCost: 20,
      tierWeightGrams: null,
      giftWeightGrams: 10,
    }), /克數與成本/);
  });
});
