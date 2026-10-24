import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { omsShipmentNotice, snapshotView } from '../snapshot-view';
import { displayOrderNumber } from '../../orders/display-order-number';

test('Shopify 畫面顯示原始訂單名稱，不改寫 HQ 追蹤單號', () => {
  assert.equal(displayOrderNumber({
    orderNumber: 'SHOP-ede728c12dc7-13865975349625',
    source: 'shopify',
    externalOrderName: '#1022',
  }), '#1022');
  assert.equal(displayOrderNumber({
    orderNumber: 'SHOP-ede728c12dc7-13865975349625',
    source: 'shopify',
    shopifySnapshot: { schemaVersion: 1, order: { name: '#1023' } },
  }), '#1023');
  assert.equal(displayOrderNumber({
    orderNumber: 'ORD-202609-014',
    source: 'manual',
    externalOrderName: '#9999',
  }), 'ORD-202609-014');
});

test('未審核和已審核未建單，不冒充待出貨', () => {
  assert.equal(omsShipmentNotice('NEW', 0), '尚未審核出貨');
  assert.equal(omsShipmentNotice('REVIEW', 0), '尚未審核出貨');
  assert.equal(omsShipmentNotice('READY', 0), '已審核，尚未建立出貨單');
});

test('舊訂單及已有出貨單繼續沿用履約顯示', () => {
  assert.equal(omsShipmentNotice(null, 0), null);
  assert.equal(omsShipmentNotice(null, 1), null);
  assert.equal(omsShipmentNotice('REVIEW', 1), null);
  assert.equal(omsShipmentNotice('FULFILLMENT_PENDING', 1), null);
  assert.equal(omsShipmentNotice('FULFILLED', 0), '尚無 HQ 出貨單，請核對物流');
});

test('來源金額保留小數與幣別，不套用本地運費或浮點運算', () => {
  const view = snapshotView({ schemaVersion: 1, order: { currency: 'USD', total_price: '160.10' } });
  assert.equal(view?.total, '160.10');
  assert.equal(view?.currency, 'USD');
  assert.equal(snapshotView(null), null);
  assert.equal(snapshotView({ schemaVersion: 1, order: {} })?.total, '');
});

test('贈禮小卡資料掛在母商品，10 元費用獨立顯示且不算出貨商品', () => {
  const view = snapshotView({ schemaVersion: 1, order: { currency: 'TWD', total_price: '469.00', line_items: [
    { title: '萬聖節限定組合', sku: 'HALLOWEEN', quantity: 1, price: '459.00', properties: [
      { name: '贈送方式', value: '贈牠的毛友＋小卡' }, { name: '收禮毛友', value: '豆豆' },
      { name: '小卡內容', value: '第一行\n第二行' }, { name: '不允許欄位', value: '不應顯示' },
    ] },
    { title: '萬聖節贈禮小卡加購', variant_id: '64947813745017', quantity: 1, price: '10.00' },
  ] } });
  assert.equal(view?.items.length, 1);
  assert.equal(view?.feeLines.length, 1);
  assert.equal(view?.items[0]?.giftCard?.recipient, '豆豆');
  assert.equal(view?.items[0]?.giftCard?.message, '第一行\n第二行');
  assert.deepEqual(view?.giftCard?.warnings, []);
});

test('小卡內容與費用不一致時顯示營運警示，舊 v1 快照仍可讀', () => {
  const paidOnly = snapshotView({ schemaVersion: 1, order: { line_items: [
    { title: '小卡費', variant_id: 64947813745017, quantity: 1, price: '10.00' },
  ] } });
  assert.match(paidOnly?.giftCard?.warnings[0] ?? '', /沒有小卡內容/);
  const contentOnly = snapshotView({ schemaVersion: 1, order: { line_items: [
    { title: '組合', quantity: 1, properties: [{ name: '小卡內容', value: '祝福' }] },
  ] } });
  assert.match(contentOnly?.giftCard?.warnings[0] ?? '', /沒有小卡加購費/);
  assert.equal(snapshotView({ schemaVersion: 1, order: { line_items: [{ title: '舊商品', quantity: 1 }] } })?.items[0]?.title, '舊商品');
});

// Source guards complement policy tests; browser rendering is verified separately.
test('OMS 金額和付款區塊採唯讀分支，舊元件仍保留', () => {
  const page = readFileSync(new URL('../../../app/(main)/orders/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /order\.omsStatus \? \([\s\S]*?Shopify 原始總額/);
  assert.match(page, /不重新計算運費或稅費/);
  assert.match(page, /<OrderAmountSummary/);
  assert.match(page, /<OrderPaymentStatusToggles/);
});
