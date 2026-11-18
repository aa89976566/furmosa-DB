import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteDefaultBuyoutTier } from '../buyout-pricing.ts';

test('肉乾買斷為零售價 8 折並四捨五入整元', () => {
  const quote = quoteDefaultBuyoutTier({
    name: '嚎大大雞霸',
    category: 'treats',
    retailUnitPrice: 165,
    quantity: 1,
  });
  assert.deepEqual(quote, {
    ruleId: 'sheet-buyout-v1',
    discountBps: 2000,
    retailUnitPrice: 165,
    wholesaleUnitPrice: 132,
    calculation: 'retail_discount',
  });
});

test('凍乾買斷為零售價 7 折並四捨五入整元', () => {
  const quote = quoteDefaultBuyoutTier({
    name: '丁香魚凍乾',
    category: 'freeze_dried',
    retailUnitPrice: 216,
    quantity: 1,
  });
  assert.equal(quote.discountBps, 3000);
  assert.equal(quote.wholesaleUnitPrice, 151);
});

test('兩款單支小禮包固定為 NT$25', () => {
  const quote = quoteDefaultBuyoutTier({
    name: '棒棒牛小禮包',
    category: 'treats',
    retailUnitPrice: 45,
    quantity: 1,
  });
  assert.equal(quoteDefaultBuyoutTier({
    name: '棒棒雞｜單支小禮包',
    category: 'treats',
    retailUnitPrice: 45,
    quantity: 1,
  }).wholesaleUnitPrice, 25);
  assert.equal(quote.calculation, 'fixed_price');
  assert.equal(quote.wholesaleUnitPrice, 25);
});

test('買斷數量必須大於零', () => {
  assert.throws(
    () => quoteDefaultBuyoutTier({
      name: '黃金條',
      category: 'treats',
      retailUnitPrice: 165,
      quantity: 0,
    }),
    /大於 0/,
  );
});
