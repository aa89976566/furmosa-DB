import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planLineShopPaymentHandoff,
  readLineShopRecipientFromNote,
} from '@/lib/orders/line-shop-handoff';

const baseOrder = {
  source: 'line',
  externalStore: 'line-chat',
  status: 'draft',
  shippingMethod: 'convenience',
  shippingAddress: '忠孝門市 123456',
  cvsBrand: '711',
  cvsStoreId: null,
  cvsStoreName: '忠孝門市 123456',
  customerId: null,
  customer: null,
  note: [
    '[LINE 對話購物｜人工轉帳待核帳]',
    '收件人：王小明',
    '手機：0912345678',
    '7-ELEVEN 門市：忠孝門市 123456',
    '轉帳末五碼：12345',
  ].join('\n'),
  items: [{
    productId: 'product-1',
    productName: '雞肉凍乾',
    sku: 'FD-CHICKEN-30',
    quantity: 2,
    weightGrams: 30,
    variantKey: 'tier-1',
    unit: 'g',
  }],
  shipments: [] as Array<{ status: string }>,
};

test('reads only the fixed LINE shop recipient labels', () => {
  assert.deepEqual(readLineShopRecipientFromNote(baseOrder.note), {
    name: '王小明',
    phone: '0912345678',
  });
  assert.deepEqual(readLineShopRecipientFromNote('一般備註\n手機：0912345678'), {
    name: null,
    phone: '0912345678',
  });
});

test('paid LINE chat order creates one structured 7-ELEVEN shipment plan', () => {
  const plan = planLineShopPaymentHandoff(baseOrder, 'paid');
  assert.deepEqual(plan.orderData, { paymentStatus: 'paid', status: 'confirmed' });
  assert.deepEqual(plan.shipment, {
    type: 'customer_order',
    status: 'pending',
    customerId: null,
    recipientName: '王小明',
    recipientPhone: '0912345678',
    recipientAddress: '忠孝門市 123456',
    carrier: '7-11',
    notes: 'LINE 對話購物｜人工轉帳已核帳',
    items: [{
      productId: 'product-1',
      productName: '雞肉凍乾',
      sku: 'FD-CHICKEN-30',
      quantity: 2,
      weightGrams: 30,
      variantKey: 'tier-1',
      unit: 'g',
    }],
  });
});

test('unpaid and non-LINE orders keep the existing payment-only behavior', () => {
  assert.deepEqual(planLineShopPaymentHandoff(baseOrder, 'unpaid'), {
    orderData: { paymentStatus: 'unpaid' },
    shipment: null,
  });
  assert.deepEqual(planLineShopPaymentHandoff({ ...baseOrder, source: 'manual' }, 'paid'), {
    orderData: { paymentStatus: 'paid' },
    shipment: null,
  });
});

test('an active shipment prevents duplicate LINE shipment creation', () => {
  assert.deepEqual(
    planLineShopPaymentHandoff({ ...baseOrder, shipments: [{ status: 'pending' }] }, 'paid'),
    { orderData: { paymentStatus: 'paid', status: 'confirmed' }, shipment: null },
  );
});

test('a cancelled shipment may be replaced after payment', () => {
  const plan = planLineShopPaymentHandoff(
    { ...baseOrder, shipments: [{ status: 'cancelled' }] },
    'paid',
  );
  assert.ok(plan.shipment);
});

test('paid LINE order fails closed when recipient data or items are incomplete', () => {
  assert.throws(
    () => planLineShopPaymentHandoff({ ...baseOrder, note: null }, 'paid'),
    /收件人姓名、手機/,
  );
  assert.throws(
    () => planLineShopPaymentHandoff({ ...baseOrder, shippingAddress: null }, 'paid'),
    /收件地址或門市/,
  );
  assert.throws(
    () => planLineShopPaymentHandoff({ ...baseOrder, items: [] }, 'paid'),
    /商品明細/,
  );
});

test('registered customer is a safe fallback for name and phone', () => {
  const plan = planLineShopPaymentHandoff({
    ...baseOrder,
    shippingMethod: 'home',
    shippingAddress: '台北市中山區範例路 1 號',
    cvsBrand: null,
    cvsStoreName: null,
    note: '[LINE 對話購物｜人工轉帳待核帳]',
    customerId: 'customer-1',
    customer: { name: '林小華', phone: '0987654321' },
  }, 'paid');
  assert.equal(plan.shipment?.recipientName, '林小華');
  assert.equal(plan.shipment?.recipientPhone, '0987654321');
  assert.equal(plan.shipment?.carrier, '黑貓');
});
