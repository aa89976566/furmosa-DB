import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyJarExchangeConsignmentPricing,
  isJarExchangeConsignmentDelivery,
  isJarExchangeProductName,
} from '@/lib/jar-exchange/revenue';

test('isJarExchangeProductName', () => {
  assert.equal(isJarExchangeProductName('換罐-牛肉凍乾'), true);
  assert.equal(isJarExchangeProductName('牛肉凍乾'), false);
});

test('isJarExchangeConsignmentDelivery', () => {
  assert.equal(
    isJarExchangeConsignmentDelivery({
      orderType: 'merchant',
      merchantId: 'm1',
      customerId: null,
      items: [{ productName: '換罐-牛肉凍乾' }],
    }),
    true,
  );
  assert.equal(
    isJarExchangeConsignmentDelivery({
      orderType: 'merchant',
      merchantId: 'm1',
      customerId: 'c1',
      items: [{ productName: '換罐-牛肉凍乾' }],
    }),
    false,
  );
  assert.equal(
    isJarExchangeConsignmentDelivery({
      orderType: 'merchant',
      merchantId: 'm1',
      customerId: null,
      items: [{ productName: '一般商品' }],
    }),
    false,
  );
});

test('applyJarExchangeConsignmentPricing zeros amounts', () => {
  const payload = applyJarExchangeConsignmentPricing({
    orderType: 'merchant',
    source: 'consignment',
    merchantId: 'm1',
    customerId: null,
    items: [
      { productName: '換罐-牛肉凍乾', unitPrice: 99, lineSubtotal: 198 },
    ],
    subtotal: 198,
    discount: 0,
    shippingFee: 0,
    total: 198,
    note: null,
  });
  assert.equal(payload.total, 0);
  assert.equal(payload.items[0].unitPrice, 0);
  assert.match(payload.note ?? '', /不計營收/);
});
