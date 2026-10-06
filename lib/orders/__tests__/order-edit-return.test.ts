import assert from 'node:assert/strict';
import test from 'node:test';

import { isOrderEditable } from '../build-edit-initial';
import { safeOrderEditReturnTo, withOrderSavedNotice } from '../order-edit-return';

test('運輸區可返回原本選取的出貨單', () => {
  assert.equal(
    safeOrderEditReturnTo('/shipments?s=shipment_123'),
    '/shipments?s=shipment_123',
  );
});

test('拒絕外部網址與非出貨頁返回位置', () => {
  assert.equal(safeOrderEditReturnTo('https://example.com/shipments?s=x'), null);
  assert.equal(safeOrderEditReturnTo('/orders/order_123'), null);
  assert.equal(safeOrderEditReturnTo('/shipments'), null);
});

test('未出貨訂單可以修改品項', () => {
  assert.equal(isOrderEditable({ status: 'confirmed', subscriptionId: null }).ok, true);
  assert.equal(isOrderEditable({
    status: 'packed',
    subscriptionId: null,
    fulfillmentStatus: 'packed',
    shippedAt: null,
    shipments: [{ status: 'pending' }],
  }).ok, true);
});

test('已出貨訂單改為唯讀', () => {
  assert.equal(isOrderEditable({ status: 'shipped', subscriptionId: null }).ok, false);
  assert.equal(isOrderEditable({
    status: 'confirmed',
    subscriptionId: null,
    fulfillmentStatus: 'shipped',
  }).ok, false);
  assert.equal(isOrderEditable({
    status: 'confirmed',
    subscriptionId: null,
    shippedAt: new Date('2026-10-01'),
  }).ok, false);
  assert.equal(isOrderEditable({
    status: 'confirmed',
    subscriptionId: null,
    fulfillmentStatus: 'pending',
    shipments: [{ status: 'delivered' }],
  }).ok, false);
});

test('儲存成功的返回網址帶有一次提示', () => {
  assert.equal(
    withOrderSavedNotice('/orders/order_1', 'created'),
    '/orders/order_1?saved=created',
  );
  assert.equal(
    withOrderSavedNotice('/shipments?s=shipment_123'),
    '/shipments?s=shipment_123&saved=updated',
  );
});

test('完成、取消與訂閱衍生訂單維持鎖定', () => {
  assert.equal(isOrderEditable({ status: 'completed', subscriptionId: null }).ok, false);
  assert.equal(isOrderEditable({ status: 'cancelled', subscriptionId: null }).ok, false);
  assert.equal(isOrderEditable({ status: 'confirmed', subscriptionId: 'sub_1' }).ok, false);
});
