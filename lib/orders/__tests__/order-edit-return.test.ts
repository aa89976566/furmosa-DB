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

test('待出貨訂單可修改，已出貨訂單改為唯讀', () => {
  assert.equal(isOrderEditable({ status: 'confirmed', subscriptionId: null, omsStatus: null }).ok, true);
  assert.equal(isOrderEditable({ status: 'shipped', subscriptionId: null, omsStatus: null }).ok, false);
  assert.equal(isOrderEditable({ status: 'confirmed', subscriptionId: null, omsStatus: null, shipments: [{ status: 'delivered' }] }).ok, false);
});

test('儲存成功的返回網址帶有提示', () => {
  assert.equal(withOrderSavedNotice('/orders/order_1', 'created'), '/orders/order_1?saved=created');
  assert.equal(withOrderSavedNotice('/shipments?s=shipment_123'), '/shipments?s=shipment_123&saved=updated');
});

test('完成、取消與訂閱衍生訂單維持鎖定', () => {
  assert.equal(isOrderEditable({ status: 'completed', subscriptionId: null, omsStatus: null }).ok, false);
  assert.equal(isOrderEditable({ status: 'cancelled', subscriptionId: null, omsStatus: null }).ok, false);
  assert.equal(isOrderEditable({ status: 'confirmed', subscriptionId: 'sub_1', omsStatus: null }).ok, false);
});
