import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertCarrierHomeOrDeliveryRecipient,
  assertHomeOrDeliveryRecipient,
  carrierRequiresHomeOrDeliveryRecipient,
  HOME_OR_DELIVERY_RECIPIENT_REQUIREMENTS,
  parseHqShippingMethod,
  shippingMethodRequiresHomeOrDeliveryRecipient,
} from '../shipping-policy';

const complete = {
  recipientName: '王小明',
  recipientPhone: '0912345678',
  recipientAddress: '新北市淡水區測試路 1 號',
};

test('必填對照只定義一次且為姓名、電話、地址', () => {
  assert.deepEqual(
    HOME_OR_DELIVERY_RECIPIENT_REQUIREMENTS.map((row) => row.field),
    ['recipientName', 'recipientPhone', 'recipientAddress'],
  );
});

test('HQ 未知或空 shippingMethod 直接 throw，不變成 home', () => {
  assert.equal(parseHqShippingMethod('home'), 'home');
  assert.equal(parseHqShippingMethod('delivery'), 'delivery');
  assert.equal(parseHqShippingMethod('convenience'), 'convenience');
  assert.throws(() => parseHqShippingMethod(''), /請選擇運送方式/);
  assert.throws(() => parseHqShippingMethod(null), /請選擇運送方式/);
  assert.throws(() => parseHqShippingMethod('black_cat'), /請選擇運送方式/);
  assert.equal(shippingMethodRequiresHomeOrDeliveryRecipient('home'), true);
  assert.equal(shippingMethodRequiresHomeOrDeliveryRecipient('delivery'), true);
  assert.equal(shippingMethodRequiresHomeOrDeliveryRecipient('convenience'), false);
});

test('HQ home／delivery 缺任一欄拒絕，填齊通過', () => {
  assert.throws(
    () => assertHomeOrDeliveryRecipient({ ...complete, recipientName: ' ' }),
    /請填寫收件人姓名/,
  );
  assert.throws(
    () => assertHomeOrDeliveryRecipient({ ...complete, recipientPhone: '' }),
    /請填寫收件人電話/,
  );
  assert.throws(
    () => assertHomeOrDeliveryRecipient({ ...complete, recipientAddress: null }),
    /請填寫收件地址/,
  );
  assert.doesNotThrow(() => assertHomeOrDeliveryRecipient(complete));
});

test('restock 只對黑貓與送貨驗證，其他／自送／順豐／空不套 home', () => {
  assert.equal(carrierRequiresHomeOrDeliveryRecipient('黑貓'), true);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient('送貨'), true);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient('7-11'), false);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient('自送'), false);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient('順豐'), false);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient('其他'), false);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient(''), false);
  assert.equal(carrierRequiresHomeOrDeliveryRecipient(null), false);

  assert.throws(
    () => assertCarrierHomeOrDeliveryRecipient('黑貓', { ...complete, recipientAddress: '' }),
    /請填寫收件地址/,
  );
  assert.throws(
    () => assertCarrierHomeOrDeliveryRecipient('送貨', { ...complete, recipientPhone: null }),
    /請填寫收件人電話/,
  );
  assert.doesNotThrow(() => assertCarrierHomeOrDeliveryRecipient('黑貓', complete));
  assert.doesNotThrow(() => assertCarrierHomeOrDeliveryRecipient('送貨', complete));
  assert.doesNotThrow(() =>
    assertCarrierHomeOrDeliveryRecipient('自送', {
      recipientName: null,
      recipientPhone: null,
      recipientAddress: null,
    }),
  );
  assert.doesNotThrow(() =>
    assertCarrierHomeOrDeliveryRecipient('順豐', {
      recipientName: null,
      recipientPhone: null,
      recipientAddress: null,
    }),
  );
  assert.doesNotThrow(() =>
    assertCarrierHomeOrDeliveryRecipient(null, {
      recipientName: null,
      recipientPhone: null,
      recipientAddress: null,
    }),
  );
});

test('兩條 restock 路徑共用 createRestockOrderWithShipment，且依 carrier 而非 shippingMethod', () => {
  const restock = readFileSync(new URL('../merchant-restock-order.ts', import.meta.url), 'utf8');
  const hqAction = readFileSync(
    new URL('../../app/(main)/merchants/[id]/actions.ts', import.meta.url),
    'utf8',
  );
  const posApprove = readFileSync(
    new URL('../restock-request/service.ts', import.meta.url),
    'utf8',
  );
  assert.match(restock, /assertCarrierHomeOrDeliveryRecipient\(input\.carrier/);
  assert.doesNotMatch(
    restock.slice(restock.indexOf('export async function createRestockOrderWithShipment')),
    /assertCarrierHomeOrDeliveryRecipient\([^)]*shippingMethod/,
  );
  assert.match(hqAction, /createRestockOrderWithShipment\(/);
  assert.match(posApprove, /createRestockOrderWithShipment\(/);
  assert.doesNotMatch(hqAction, /assertCarrierHomeOrDeliveryRecipient/);
  assert.doesNotMatch(posApprove, /assertCarrierHomeOrDeliveryRecipient/);
  assert.doesNotMatch(posApprove, /assertHomeOrDeliveryRecipient/);
});
