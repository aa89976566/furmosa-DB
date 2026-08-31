import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASE_VARIANT_KEY,
  findMerchantWholesalePrice,
  normalizeWholesaleUnitPrice,
  wholesaleVariantKey,
} from '@/lib/orders/merchant-wholesale-price';

test('無規格商品使用固定的進貨價鍵值', () => {
  assert.equal(wholesaleVariantKey(''), BASE_VARIANT_KEY);
  assert.equal(wholesaleVariantKey(null), BASE_VARIANT_KEY);
  assert.equal(wholesaleVariantKey('tier-1'), 'tier-1');
});

test('進貨價必須大於零並四捨五入至小數第二位', () => {
  assert.equal(normalizeWholesaleUnitPrice('88.126'), 88.13);
  assert.equal(normalizeWholesaleUnitPrice(0), null);
  assert.equal(normalizeWholesaleUnitPrice('abc'), null);
});

test('進貨價必須同時符合店家、商品與規格', () => {
  const prices = [
    { merchantId: 'm1', productId: 'p1', variantKey: 'tier-1', unitPrice: 80 },
    { merchantId: 'm2', productId: 'p1', variantKey: 'tier-1', unitPrice: 95 },
  ];

  assert.equal(findMerchantWholesalePrice(prices, 'm1', 'p1', 'tier-1'), 80);
  assert.equal(findMerchantWholesalePrice(prices, 'm1', 'p1', 'tier-2'), null);
});
