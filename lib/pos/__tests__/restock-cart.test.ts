import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addRestockCartLine,
  defaultRestockAddQty,
  removeRestockCartLine,
  restockCartTotalPieces,
  setRestockCartQty,
} from '@/lib/pos/restock-cart';

describe('restock cart', () => {
  it('merges the same product instead of adding a second row', () => {
    const first = addRestockCartLine([], {
      productId: 'p1',
      name: '柳葉魚凍乾',
      imageUrl: null,
      quantity: 6,
    });
    const second = addRestockCartLine(first, {
      productId: 'p1',
      name: '柳葉魚凍乾',
      imageUrl: null,
      quantity: 2,
    });
    assert.equal(second.length, 1);
    assert.equal(second[0]?.quantity, 8);
    assert.equal(restockCartTotalPieces(second), 8);
  });

  it('uses suggested qty when present, otherwise 1', () => {
    assert.equal(defaultRestockAddQty(6), 6);
    assert.equal(defaultRestockAddQty(0), 1);
  });

  it('updates and removes lines', () => {
    const lines = addRestockCartLine([], {
      productId: 'p1',
      name: '水晶魚',
      imageUrl: null,
      quantity: 4,
    });
    const updated = setRestockCartQty(lines, 'p1', 3);
    assert.equal(updated[0]?.quantity, 3);
    assert.equal(removeRestockCartLine(updated, 'p1').length, 0);
  });
});
