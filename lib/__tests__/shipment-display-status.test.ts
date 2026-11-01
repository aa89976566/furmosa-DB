import assert from 'node:assert/strict';
import test from 'node:test';
import { shipmentDisplayStatus } from '../shipment';

test('取消上游訂單時舊待出貨紀錄不再顯示可出貨狀態', () => {
  for (const status of ['pending', 'packed', 'shipped', 'delivered', 'received']) {
    assert.equal(shipmentDisplayStatus(status, 'cancelled'), 'cancelled');
  }
});

test('一般訂單與無上游的訂閱出貨保留實際物流狀態', () => {
  for (const status of ['pending', 'packed', 'shipped', 'delivered', 'received', 'cancelled']) {
    for (const orderStatus of ['confirmed', 'shipped', 'completed', null, undefined]) {
      assert.equal(shipmentDisplayStatus(status, orderStatus), status);
    }
  }
});
