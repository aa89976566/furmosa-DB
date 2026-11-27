import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LINE_SHOP_711_FEE,
  LINE_SHOP_FREE_SHIPPING_THRESHOLD,
  computeLineShopCartSummary,
  buildLineShopCartMessages,
  resolveLineShopShipping,
  shopCartSubtotal,
} from '@/lib/line/shop-checkout';

test('LINE shop subtotal sums quantity', () => {
  assert.equal(shopCartSubtotal([{ productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '單一規格', price: 299, quantity: 2 }]), 598);
});

test('LINE shop cart summary reports shipping threshold boundary', () => {
  const item = (price: number) => ({
    productId: 'p', title: '商品', variantId: 'v', variantTitle: '單一規格',
    price, quantity: 1,
  });
  assert.deepEqual(computeLineShopCartSummary([item(1198)]), {
    subtotal: 1198,
    shippingMode: '711',
    shippingFee: 60,
    shippingLabel: '7-ELEVEN 取貨',
    freeShippingGap: 1,
    total: 1258,
  });
  assert.equal(computeLineShopCartSummary([item(1199)]).shippingMode, 'home');
  assert.equal(computeLineShopCartSummary([item(1199)]).freeShippingGap, 0);
  assert.equal(computeLineShopCartSummary([item(1200)]).shippingFee, 0);
});

test('LINE shop cart reply keeps shipping and fee together with postback actions', () => {
  const raw = JSON.stringify(buildLineShopCartMessages({
    items: [{
      productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '單一規格',
      price: 330, quantity: 1,
    }],
  }));
  assert.match(raw, /7-ELEVEN 取貨，運費 NT\$60/);
  assert.match(raw, /再買 NT\$869/);
  assert.match(raw, /"type":"flex"/);
  assert.match(raw, /尚未下單/);
  assert.match(raw, /jd=shop_checkout/);
  assert.match(raw, /jd=shop_home/);
  assert.doesNotMatch(raw, /"type":"message"/);
});

test('LINE shop cart shows variant and total quantity on desktop', () => {
  const raw = JSON.stringify(buildLineShopCartMessages({
    items: [{
      productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '45g',
      price: 299, quantity: 2,
    }],
  }));
  assert.match(raw, /雞霸｜45g × 2/);
  assert.match(raw, /購物車 2 件｜小計 NT\$598/);
});

test('LINE shop empty cart has a desktop-safe route back to categories', () => {
  const raw = JSON.stringify(buildLineShopCartMessages({ items: [] }));
  assert.match(raw, /"type":"flex"/);
  assert.match(raw, /jd=shop_home/);
  assert.doesNotMatch(raw, /quickReply/);
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
