import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveLegacyPieceVariantRepairs } from '../inventory/legacy-piece-variant';

describe('舊出貨單單件規格相容', () => {
  it('鴨翅 3 隻缺少 variantKey 時補上唯一的每隻規格', () => {
    const repairs = resolveLegacyPieceVariantRepairs(
      [{ id: 'line', productId: 'duck-wing', quantity: 3, unit: '隻', weightGrams: null, variantKey: null } as never],
      [{
        id: 'duck-wing',
        unit: '隻',
        priceTiers: [
          { id: 'one-wing', unit: '隻', unitQty: 1, weightGrams: null },
          { id: '30g', unit: 'g', unitQty: 1, weightGrams: 30 },
        ],
      }],
    );
    assert.deepEqual(repairs, [{ itemId: 'line', variantKey: 'one-wing' }]);
  });

  it('不猜測重量、既有規格、單位不一致或多個單件規格', () => {
    const products = [{
      id: 'p',
      unit: '隻',
      priceTiers: [
        { id: 'one-a', unit: '隻', unitQty: 1, weightGrams: null },
        { id: 'one-b', unit: '隻', unitQty: 1, weightGrams: null },
      ],
    }];
    const items = [
      { id: 'weighted', productId: 'p', unit: '隻', weightGrams: 30, variantKey: null },
      { id: 'selected', productId: 'p', unit: '隻', weightGrams: null, variantKey: 'one-a' },
      { id: 'wrong-unit', productId: 'p', unit: '片', weightGrams: null, variantKey: null },
      { id: 'ambiguous', productId: 'p', unit: '隻', weightGrams: null, variantKey: null },
    ];
    assert.deepEqual(resolveLegacyPieceVariantRepairs(items, products), []);
  });
});
