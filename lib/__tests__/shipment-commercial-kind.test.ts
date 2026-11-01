import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveShipmentDisplayKind,
  shipmentDisplayKindLabel,
  shipmentWhereForKind,
} from '../order-hub-kinds';

test('merchant restock display kind uses the canonical order mode', () => {
  assert.equal(resolveShipmentDisplayKind({ type: 'merchant_restock', merchantOrderMode: 'consignment' }), 'merchant_consignment');
  assert.equal(resolveShipmentDisplayKind({ type: 'merchant_restock', merchantOrderMode: 'wholesale' }), 'merchant_wholesale');
  assert.equal(resolveShipmentDisplayKind({ type: 'merchant_restock', merchantOrderMode: 'jar_exchange' }), 'merchant_jar_exchange');
});

test('missing or unknown merchant order modes are explicit instead of becoming consignment', () => {
  assert.equal(resolveShipmentDisplayKind({ type: 'merchant_restock', merchantOrderMode: null }), 'merchant_unclassified');
  assert.equal(resolveShipmentDisplayKind({ type: 'merchant_restock', merchantOrderMode: 'future_mode' }), 'merchant_unclassified');
});

test('non-restock shipment types ignore an accidental merchant order mode', () => {
  assert.equal(resolveShipmentDisplayKind({ type: 'customer_order', merchantOrderMode: 'jar_exchange' }), 'customer_order');
  assert.equal(resolveShipmentDisplayKind({ type: 'subscription', merchantOrderMode: 'consignment' }), 'subscription');
});

test('labels distinguish all merchant commercial modes', () => {
  assert.equal(shipmentDisplayKindLabel.merchant_consignment, '寄賣');
  assert.equal(shipmentDisplayKindLabel.merchant_wholesale, '進貨');
  assert.equal(shipmentDisplayKindLabel.merchant_jar_exchange, '換罐計畫');
  assert.equal(shipmentDisplayKindLabel.merchant_unclassified, '模式未設定');
});

test('legacy consignment filter still means every merchant restock', () => {
  assert.deepEqual(shipmentWhereForKind('consignment'), {
    OR: [
      { type: 'merchant_restock' },
      { type: 'customer_order', order: { source: 'consignment' } },
    ],
  });
});

test('new merchant filters use merchantOrderMode and keep null explicit', () => {
  assert.deepEqual(shipmentWhereForKind('merchant_jar_exchange'), {
    type: 'merchant_restock',
    order: { merchantOrderMode: 'jar_exchange' },
  });
  assert.deepEqual(shipmentWhereForKind('merchant_unclassified'), {
    type: 'merchant_restock',
    OR: [
      { orderId: null },
      { order: { merchantOrderMode: null } },
      { order: { merchantOrderMode: { notIn: ['consignment', 'wholesale', 'jar_exchange'] } } },
    ],
  });
});
