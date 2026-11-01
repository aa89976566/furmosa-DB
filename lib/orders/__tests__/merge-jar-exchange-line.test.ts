import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeJarExchangeLine } from '../merge-jar-exchange-line';

test('換罐計畫新增相同商品與規格時，累加數量而非建立第二列', () => {
  const existing = [
    { productId: 'beef', tierId: '30g', quantity: 3, isGift: false, key: 'line-1' },
  ];
  const result = mergeJarExchangeLine(existing, {
    productId: 'beef', tierId: '30g', quantity: 1, isGift: false, key: 'line-2',
  });

  assert.equal(result.merged, true);
  assert.deepEqual(result.items, [
    { productId: 'beef', tierId: '30g', quantity: 4, isGift: false, key: 'line-1' },
  ]);
});

test('不同規格或贈品不與換罐補貨列合併', () => {
  const existing = [
    { productId: 'beef', tierId: '30g', quantity: 3, isGift: false, key: 'line-1' },
  ];

  assert.equal(mergeJarExchangeLine(existing, {
    productId: 'beef', tierId: '50g', quantity: 1, isGift: false, key: 'line-2',
  }).items.length, 2);

  assert.equal(mergeJarExchangeLine(existing, {
    productId: 'beef', tierId: '30g', quantity: 1, isGift: true, key: 'gift-1',
  }).items.length, 2);
});
