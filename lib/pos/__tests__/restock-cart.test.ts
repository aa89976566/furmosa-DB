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

  it('starts quick restock at zero regardless of suggestion', () => {
    assert.equal(defaultRestockAddQty(6), 0);
    assert.equal(defaultRestockAddQty(0), 0);
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

  it('keeps the chosen variant when increasing the existing cart line', () => {
    const first = addRestockCartLine([], { productId: 'duck', name: '鴨肺', imageUrl: null, quantity: 2, variantKey: '50g' });
    const second = addRestockCartLine(first, { productId: 'duck', name: '鴨肺', imageUrl: null, quantity: 1, variantKey: '50g' });
    assert.equal(second[0]?.variantKey, '50g');
    assert.equal(second[0]?.quantity, 3);
  });
});

it('keeps duck lung quantities independent by variant', () => {
 const first = addRestockCartLine([], {productId:'duck',name:'鴨肺',imageUrl:null,quantity:2,variantKey:'30g'});
 const both = addRestockCartLine(first, {productId:'duck',name:'鴨肺',imageUrl:null,quantity:3,variantKey:'50g'});
 assert.equal(both.length,2);
 assert.deepEqual(setRestockCartQty(both,'duck',4,'30g').map(l => l.quantity),[4,3]);
 assert.equal(removeRestockCartLine(both,'duck','30g')[0].variantKey,'50g');
 assert.equal(addRestockCartLine([], {productId:'duck',name:'鴨肺',imageUrl:null,quantity:0}).length,0);
});
