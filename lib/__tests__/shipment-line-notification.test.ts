import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildShipmentSentLineText,
  shouldNotifyShipmentSent,
} from '../shipment-line-notification';

test('只有首次從待出貨或已備貨進入已寄出才通知', () => {
  assert.equal(shouldNotifyShipmentSent('pending', 'shipped'), true);
  assert.equal(shouldNotifyShipmentSent('packed', 'shipped'), true);
  assert.equal(shouldNotifyShipmentSent('delivered', 'shipped'), false);
  assert.equal(shouldNotifyShipmentSent('shipped', 'delivered'), false);
  assert.equal(shouldNotifyShipmentSent('shipped', 'shipped'), false);
});

test('出貨通知優先顯示訂單編號並包含物流資料', () => {
  const text = buildShipmentSentLineText({
    shipmentNumber: 'SHP-202609-001',
    orderNumber: 'ORD-202609-017',
    customerName: '翻肚肚',
    carrier: '7-11',
    trackingNumber: '1234-5678-9012',
  });

  assert.match(text, /翻肚肚您好/);
  assert.match(text, /訂單編號：ORD-202609-017/);
  assert.match(text, /物流方式：7-11/);
  assert.match(text, /追蹤碼：1234-5678-9012/);
  assert.doesNotMatch(text, /SHP-202609-001/);
});

test('缺少選填資料時仍產生可讀通知', () => {
  const text = buildShipmentSentLineText({ shipmentNumber: 'SHP-202609-002' });

  assert.equal(
    text,
    ['您的訂單已寄出。', '訂單編號：SHP-202609-002', '實際到貨時間依物流配送為準。'].join('\n'),
  );
});
