import assert from 'node:assert/strict';
import test from 'node:test';
import { incomingHqGrams, missingShipmentDeductions, outstandingPurchaseLines, type PendingPurchase, type ShipmentAuditInput } from '../dashboard-procurement';

const receipt = { id: 'receipt1', purchaseOrderId: 'po1', items: [{ productId: 'p1', quantityGrams: 200, sourceOrderItemId: 'line1' }] };
const purchase: PendingPurchase = { id: 'po1', warehouse: { code: 'WH-MAIN' },
  items: [{ id: 'line1', productId: 'p1', productName: '雞肉丁', quantityGrams: 500, unit: 'g' }],
  receipt, receipts: [receipt] };

test('部分到貨只計算餘量；舊新收貨關聯重複不會重複抵扣', () => {
  assert.equal(outstandingPurchaseLines(purchase)[0]?.remaining, 300);
  assert.equal(incomingHqGrams([purchase]).get('p1'), 300);
  assert.equal(outstandingPurchaseLines({ ...purchase, items: [{ ...purchase.items[0]!, quantityGrams: 200 }] }).length, 0);
});

test('舊版收貨按商品歸屬，同時收多批採購正確加總', () => {
  const legacy = { ...receipt, items: [{ ...receipt.items[0]!, sourceOrderItemId: null }] };
  assert.equal(outstandingPurchaseLines({ ...purchase, receipt: legacy, receipts: [] })[0]?.remaining, 300);
  assert.equal(incomingHqGrams([purchase, { ...purchase, id: 'po2', receipt: null, receipts: [] }]).get('p1'), 800);
});

test('其他倉庫與非 g 採購不會被抵入主倉克數', () => {
  assert.equal(incomingHqGrams([
    { ...purchase, warehouse: { code: 'OTHER' } },
    { ...purchase, items: [{ ...purchase.items[0]!, unit: '隻' }] },
  ]).size, 0);
});

const shipment: ShipmentAuditInput = { id: 's1', shipmentNumber: 'SHP-1', status: 'shipped', hqInventoryEligible: true,
  order: null, items: [{ productId: 'p1', productName: '雞肉丁', quantity: 1, product: { sku: 'FUR-0020', category: 'freeze_dried' } }] };
const posted = { reference: 'shipment:s1', productId: 'p1', quantity: -30, eventKey: 'event1' };

test('納管出貨逐商品檢查，部分有扣帳仍能找出缺少的商品', () => {
  assert.equal(missingShipmentDeductions([shipment], []).length, 1);
  assert.deepEqual(missingShipmentDeductions([shipment], [posted]), []);
  const mixed = { ...shipment, items: [...shipment.items, { ...shipment.items[0]!, productId: 'p2', productName: '牛肉丁' }] };
  assert.deepEqual(missingShipmentDeductions([mixed], [posted])[0]?.missing, ['牛肉丁']);
});

test('待出貨、未納管歷史單、退貨退款與現做品不會誤報缺扣', () => {
  for (const changed of [
    { ...shipment, status: 'pending' }, { ...shipment, hqInventoryEligible: false },
    { ...shipment, order: { status: 'cancelled', fulfillmentStatus: 'fulfilled', paymentStatus: 'paid' } },
    { ...shipment, order: { status: 'shipped', fulfillmentStatus: 'returned', paymentStatus: 'paid' } },
    { ...shipment, order: { status: 'shipped', fulfillmentStatus: 'fulfilled', paymentStatus: 'refunded' } },
    { ...shipment, items: [{ ...shipment.items[0]!, product: { sku: 'FUR-0002', category: 'treats' } }] },
    { ...shipment, items: [{ ...shipment.items[0]!, product: { sku: 'TOY-1', category: 'toys' } }] },
  ]) assert.deepEqual(missingShipmentDeductions([changed], []), []);
});

test('錯誤商品、其他出貨、正向異動或無事件識別都不能當作扣帳證據', () => {
  for (const changed of [{ ...posted, productId: 'other' }, { ...posted, reference: 'shipment:other' },
    { ...posted, quantity: 30 }, { ...posted, eventKey: null }]) {
    assert.equal(missingShipmentDeductions([shipment], [changed]).length, 1);
  }
});

test('舊流程 omsStatus=null 的納管出貨仍須檢查', () => {
  const legacyOrder = { ...shipment, order: { status: 'shipped', fulfillmentStatus: 'fulfilled', paymentStatus: 'paid' } };
  assert.equal(missingShipmentDeductions([legacyOrder], []).length, 1);
  assert.equal(missingShipmentDeductions([legacyOrder], [posted]).length, 0);
});
