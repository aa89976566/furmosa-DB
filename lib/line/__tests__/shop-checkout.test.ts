import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LINE_SHOP_711_FEE,
  LINE_SHOP_FREE_SHIPPING_THRESHOLD,
  resolveLineShopShipping,
  shopCartSubtotal,
} from '@/lib/line/shop-checkout';

test('LINE shop subtotal sums quantity', () => {
  assert.equal(shopCartSubtotal([{ productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '單一規格', price: 299, quantity: 2 }]), 598);
});

test('LINE shop below threshold uses 7-ELEVEN and NT$60', () => {
  assert.deepEqual(resolveLineShopShipping(LINE_SHOP_FREE_SHIPPING_THRESHOLD - 1), {
    mode: '711', fee: LINE_SHOP_711_FEE, label: '7-ELEVEN 取貨',
  });
});

test('LINE shop at threshold uses free home delivery', () => {
  assert.deepEqual(resolveLineShopShipping(LINE_SHOP_FREE_SHIPPING_THRESHOLD), {
    mode: 'home', fee: 0, label: '宅配免運',
  });
});
