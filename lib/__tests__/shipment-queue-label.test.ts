import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');
const orderMatch = source.match(/function rowLabel\(s: ShipmentQueueRow\) \{([\s\S]*?)\n\}/);
const partyMatch = source.match(/function partyLabel\(s: ShipmentQueueRow\) \{([\s\S]*?)\n\}/);
assert.ok(orderMatch, 'shared order label resolver exists');
assert.ok(partyMatch, 'shared party label resolver exists');

const orderLabel = new Function('s', orderMatch[1]) as (
  shipment: Record<string, unknown>,
) => string;
const partyLabel = new Function('s', partyMatch[1]) as (
  shipment: Record<string, unknown>,
) => string;

test('有訂單時第一欄永遠顯示訂單編號', () => {
  assert.equal(
    orderLabel({
      type: 'customer_order',
      status: 'pending',
      recipientName: '高稚媛',
      order: { orderNumber: 'ORD-202609-015' },
      shipmentNumber: 'SHP-001',
    }),
    'ORD-202609-015',
  );
});

test('店家訂單也使用訂單編號，不拿店名當單號', () => {
  assert.equal(
    orderLabel({
      type: 'merchant_restock',
      merchant: { name: '洗室' },
      order: { orderNumber: 'ORD-STORE-001' },
      shipmentNumber: 'SHP-002',
    }),
    'ORD-STORE-001',
  );
});

test('訂閱單沒有訂單時使用訂閱編號', () => {
  assert.equal(
    orderLabel({
      type: 'subscription',
      subscriptionShipment: {
        shipmentNo: 'SUB-SHIP-001',
        subscription: { subscriptionNo: 'SUB-001' },
      },
      shipmentNumber: 'SHP-003',
    }),
    'SUB-001',
  );
});

test('沒有上游單號才回退出貨編號', () => {
  assert.equal(
    orderLabel({ type: 'customer_order', shipmentNumber: 'SHP-004' }),
    'SHP-004',
  );
});

test('第二欄個人訂單顯示收件人姓名', () => {
  assert.equal(
    partyLabel({
      type: 'customer_order',
      recipientName: ' 高稚媛 ',
      customer: { name: '下單人' },
    }),
    '高稚媛',
  );
});

test('第二欄店家補貨顯示店家名稱', () => {
  assert.equal(
    partyLabel({
      type: 'merchant_restock',
      merchant: { name: ' 洗室 ' },
      recipientName: '聯絡人',
    }),
    '洗室',
  );
});

test('個人訂單沒有收件人時回退客戶姓名', () => {
  assert.equal(
    partyLabel({
      type: 'customer_order',
      recipientName: ' ',
      customer: { name: ' 客戶甲 ' },
    }),
    '客戶甲',
  );
});
