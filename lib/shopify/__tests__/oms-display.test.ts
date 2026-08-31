import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { omsShipmentNotice, snapshotView } from '../snapshot-view';

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

// Source guards complement policy tests; browser rendering is verified separately.
test('OMS 金額和付款區塊採唯讀分支，舊元件仍保留', () => {
  const page = readFileSync(new URL('../../../app/(main)/orders/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /order\.omsStatus \? \([\s\S]*?Shopify 原始總額/);
  assert.match(page, /不重新計算運費或稅費/);
  assert.match(page, /<OrderAmountSummary/);
  assert.match(page, /<OrderPaymentStatusToggles/);
});
