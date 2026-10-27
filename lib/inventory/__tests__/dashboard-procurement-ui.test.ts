import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import type { DashboardProcurementData } from '../load-dashboard-procurement';

const require = createRequire(import.meta.url);
const React = require('react');
Object.assign(globalThis, { React });
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const { InventoryActionBoard } = require('../../../components/dashboard/inventory-action-board');
const empty: DashboardProcurementData = {
  reorderAlerts: { orderNow: [], incoming: [], stocktake: [] }, purchases: [], merchantStocks: [],
  merchantStockCount: 0, merchantLowThreshold: 3, shipmentAudit: { checked: 0, limit: 100, days: 30, missing: [] },
};
function render(data: DashboardProcurementData) {
  return new JSDOM(renderToStaticMarkup(React.createElement(InventoryActionBoard, { data, today: new Date('2026-10-27T00:00:00+08:00') }))).window.document;
}

test('空狀態仍顯示四個待辦分類，出貨沒有可查資料時不宣稱已全部對帳', () => {
  const document = render(empty);
  assert.equal(document.querySelectorAll('nav[aria-label="庫存待辦分類"] a').length, 4);
  for (const anchor of document.querySelectorAll('nav a')) assert.ok(document.querySelector(anchor.getAttribute('href')!));
  assert.match(document.body.textContent!, /此範圍內尚無可檢查/);
  assert.doesNotMatch(document.body.textContent!, /本次檢查未發現/);
});

test('採購帶入商品與缺口，全部商品可展開；計件商品不送到克數採購表', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, sku: `SKU${i}`, name: `商品${i}`, vendorName: '測試供應商',
    onHand: 20, reorderPoint: 100, unit: 'g', lastCountedAt: new Date(), incoming: 30, projected: 50, deficit: 50, state: 'order_now' as const }));
  rows.push({ ...rows[0]!, id: 'count', name: '計件品', unit: '隻' });
  const document = render({ ...empty, reorderAlerts: { ...empty.reorderAlerts, orderNow: rows } });
  const href = document.querySelector('#purchase-now a[href^="/inventory/purchase-orders/new"]')!.getAttribute('href')!;
  const query = new URL(href, 'https://example.test').searchParams;
  assert.equal(query.get('productId'), 'p0');
  assert.equal(query.get('quantityGrams'), '50');
  assert.match(document.querySelector('details')!.textContent!, /商品6/);
  assert.match(document.querySelector('#purchase-now')!.textContent!, /主倉現存/);
  assert.ok(document.querySelector('a[href="/products/count"]'));
  assert.equal(document.querySelectorAll('a[href^="/inventory/purchase-orders/new"]').length, 7);
});

test('負庫存和舊規格引導核對，正常店家規格可建立補貨；異常出貨可查看', () => {
  const stock = { id: 'm1', merchantId: 'merchant1', tierId: 'tier1', quantity: 0, merchant: { name: '測試店家' },
    product: { name: '雞肉丁', priceTiers: [{ id: 'tier1', weightGrams: 30, unitQty: 1, unit: 'g' }] } };
  const document = render({ ...empty, merchantStocks: [stock, { ...stock, id: 'negative', quantity: -1 }, { ...stock, id: 'legacy', tierId: '' }], merchantStockCount: 3,
    shipmentAudit: { ...empty.shipmentAudit, checked: 1, missing: [{ id: 's1', shipmentNumber: 'SHP1', missing: ['雞肉丁'] }] } });
  assert.equal(document.querySelectorAll('a[href="/merchants/restock?merchantId=merchant1"]').length, 1);
  assert.equal(document.querySelectorAll('#purchase-merchant a[href^="/inventory?q="]').length, 2);
  assert.ok(document.querySelector('a[href="/shipments/s1"]'));
  assert.match(document.body.textContent!, /不會自動補扣庫存/);
});
