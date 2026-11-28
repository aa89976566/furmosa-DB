import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LINE_SHOP_711_FEE,
  LINE_SHOP_FREE_SHIPPING_THRESHOLD,
  addLineShopProductToDraft,
  computeLineShopCartSummary,
  buildLineShopCartMessages,
  planLineShopCartMutation,
  planLineShopProductAddition,
  resolveLineShopShipping,
  resetLineShopDraftAfterCartEdit,
  shopCartSubtotal,
  updateLineShopCartItems,
} from '@/lib/line/shop-checkout';

test('LINE shop cart item controls update only the selected variant within bounds', () => {
  const original = [
    { productId: 'p1', title: '雞霸', variantId: 'v1', variantTitle: '45g', price: 299, quantity: 2 },
    { productId: 'p2', title: '牛肉凍乾', variantId: 'v2', variantTitle: '30g', price: 195, quantity: 1 },
  ];

  assert.deepEqual(updateLineShopCartItems(original, 'v1', 'increment').map((item) => item.quantity), [3, 1]);
  assert.deepEqual(updateLineShopCartItems(original, 'v1', 'decrement').map((item) => item.quantity), [1, 1]);
  assert.deepEqual(updateLineShopCartItems(original, 'v2', 'decrement').map((item) => item.variantId), ['v1']);
  assert.deepEqual(updateLineShopCartItems(original, 'v1', 'remove').map((item) => item.variantId), ['v2']);
  assert.deepEqual(updateLineShopCartItems(original, 'missing', 'remove'), original);
  assert.equal(updateLineShopCartItems([{ ...original[0], quantity: 99 }], 'v1', 'increment')[0].quantity, 99);
  assert.deepEqual(original.map((item) => item.quantity), [2, 1]);
});

test('editing a LINE shop cart clears stale checkout and recipient fields', () => {
  const items = [{ productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '45g', price: 299, quantity: 2 }];
  assert.deepEqual(resetLineShopDraftAfterCartEdit({
    items,
    checkoutKey: 'session-1',
    shippingMode: '711',
    recipientName: '王小明',
    phone: '0912345678',
    addressOrStore: '示範門市 123456',
    orderId: 'order-1',
    orderNumber: 'LINE-000001',
  }, items), { items });
});

test('pending payment locks the cart while no-op edits preserve checkout state', () => {
  const item = { productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '45g', price: 299, quantity: 2 };
  const pending = {
    items: [item], checkoutKey: 'session-1', shippingMode: '711' as const,
    recipientName: '王小明', phone: '0912345678', addressOrStore: '示範門市 123456',
    orderId: 'order-1', orderNumber: 'LINE-000001',
  };

  assert.deepEqual(planLineShopCartMutation('ASK_LAST5', pending, 'v', 'increment'), {
    status: 'locked', draft: pending,
  });
  assert.deepEqual(planLineShopCartMutation('ASK_PHONE', pending, 'missing', 'remove'), {
    status: 'unchanged', draft: pending,
  });
  assert.deepEqual(planLineShopCartMutation('ASK_PHONE', { ...pending, items: [{ ...item, quantity: 99 }] }, 'v', 'increment').status, 'unchanged');
});

test('adding from a product card shares the cart quantity cap', () => {
  const product = {
    id: 'p', title: '雞霸', handle: 'jiba', productType: '寵物零食', tags: ['零食'],
    imageUrl: null, variantId: 'v', variantTitle: '45g', price: 299, available: true,
  };
  const capped = addLineShopProductToDraft({
    items: [{ productId: 'p', title: '雞霸', variantId: 'v', variantTitle: '45g', price: 299, quantity: 99 }],
  }, product);
  assert.equal(capped.items[0].quantity, 99);
  assert.equal(addLineShopProductToDraft({ items: [] }, product).items[0].quantity, 1);

  const pending = {
    items: [], checkoutKey: 'session-1', shippingMode: '711' as const,
    recipientName: '王小明', phone: '0912345678', addressOrStore: '示範門市 123456',
    orderId: 'order-1', orderNumber: 'LINE-000001',
  };
  assert.equal(planLineShopProductAddition('ASK_LAST5', pending, product).status, 'locked');
  assert.equal(planLineShopProductAddition('CART', capped, product).status, 'unchanged');
  assert.equal(planLineShopProductAddition('CART', { items: [] }, product).status, 'updated');
});

test('large LINE carts split into payload-safe bubbles without losing items', () => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    productId: `p${index}`, title: `商品名稱${String(index).padStart(2, '0')}`,
    variantId: `v${index}`, variantTitle: '單一規格', price: 100 + index, quantity: 1,
  }));
  const messages = buildLineShopCartMessages({ items });
  assert.ok(messages.length <= 5);
  const bubbles = messages.flatMap((message) => {
    assert.equal(message.type, 'flex');
    const contents = message.contents as { type?: string; contents?: Record<string, unknown>[] };
    return contents.type === 'carousel' ? contents.contents ?? [] : [contents];
  });
  for (const bubble of bubbles) assert.ok(Buffer.byteLength(JSON.stringify(bubble)) < 30_000);
  const raw = JSON.stringify(messages);
  for (const item of items) assert.match(raw, new RegExp(item.title));
  assert.match(raw, /jd=shop_checkout/);
});

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
  assert.match(raw, /jd=shop_increment(?:&|&amp;)variant=v/);
  assert.match(raw, /jd=shop_decrement(?:&|&amp;)variant=v/);
  assert.match(raw, /jd=shop_remove(?:&|&amp;)variant=v/);
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
