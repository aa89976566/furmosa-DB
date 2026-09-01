import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listSource = readFileSync(
  new URL('../../../components/orders/order-list-table.tsx', import.meta.url),
  'utf8',
);
const detailSource = readFileSync(
  new URL('../../../app/(main)/orders/[id]/page.tsx', import.meta.url),
  'utf8',
);
const dashboardPageSource = readFileSync(
  new URL('../../../app/(main)/dashboard/page.tsx', import.meta.url),
  'utf8',
);
const dashboardWorkSource = readFileSync(
  new URL('../../../components/orders/oms-dashboard.tsx', import.meta.url),
  'utf8',
);
const omsSource = readFileSync(new URL('../oms.ts', import.meta.url), 'utf8');
const ordersPageSource = readFileSync(
  new URL('../../../app/(main)/orders/page.tsx', import.meta.url),
  'utf8',
);
const resourceListStyles = readFileSync(
  new URL('../../../components/orders/order-resource-list.module.css', import.meta.url),
  'utf8',
);
const globalStyles = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
const buttonSource = readFileSync(new URL('../../../components/ui/button.tsx', import.meta.url), 'utf8');

test('訂單使用單一自適應 Resource List，不重複產生桌機與手機 DOM', () => {
  assert.equal(listSource.includes('VirtualCardList'), false);
  assert.equal(listSource.includes('<Table'), false);
  assert.match(listSource, /OrderResourceRow/);
  assert.match(resourceListStyles, /container-type: inline-size/);
  assert.match(resourceListStyles, /@container \(min-width: 600px\)/);
  assert.match(resourceListStyles, /@container \(min-width: 900px\)/);
});

test('列表優先顯示訂單編號與問題分類，不堆疊日期及完整配送資訊', () => {
  assert.match(listSource, /className=\{styles\.orderNumber\}/);
  assert.match(listSource, /ISSUE_CATEGORY/);
  assert.match(listSource, /className=\{`\$\{styles\.issueTag\}/);
  assert.equal(listSource.includes('formatDateTime'), false);
  assert.equal(listSource.includes('logistics.destination'), false);
});

test('列表與詳細頁的既有客戶姓名都連到 CRM 主鍵', () => {
  assert.match(listSource, /href=\{`\/customers\/\$\{order\.customer\.id\}`\}/);
  assert.match(detailSource, /href=\{`\/customers\/\$\{order\.customer\.id\}`\}/);
});

test('訂單詳細頁使用四個營運區塊並隱藏進階工具', () => {
  for (const label of ['1. 訂單處理', '2. 商品內容', '3. 收件與配送', '4. 金額與處理紀錄']) {
    assert.match(detailSource, new RegExp(label.replace('.', '\\.')));
  }
  assert.match(detailSource, /更多管理工具/);
  assert.match(detailSource, /固定以新台幣顯示/);
});

test('OMS 詳細頁使用精簡工作區，問題直接標在欄位並收合次要資料', () => {
  assert.match(detailSource, /if \(order\.omsStatus\)/);
  assert.match(detailSource, /訂單摘要/);
  assert.match(detailSource, /更多資料/);
  assert.match(detailSource, /lg:grid-cols-\[minmax\(0,1fr\)_280px\]/);
  assert.equal(detailSource.includes('查看 Shopify 原始訂單資料'), false);
});

test('共用視覺基礎使用安靜表面、語意色彩與輕量邊框', () => {
  assert.match(globalStyles, /Calm operations UI/);
  assert.match(globalStyles, /--success: 145/);
  assert.match(globalStyles, /--warning: 35/);
  assert.equal(globalStyles.includes('8px 8px 0'), false);
  assert.match(buttonSource, /border border-primary/);
  assert.equal(buttonSource.includes('border-2 border-primary'), false);
});

test('Dashboard 分開今日工作與營運數據，不再疊加舊區塊', () => {
  assert.match(dashboardPageSource, /今日工作/);
  assert.match(dashboardPageSource, /營運數據/);
  for (const removed of ['DashboardSearch', 'DashboardTasksSection', '搜尋與今日任務']) {
    assert.equal(dashboardPageSource.includes(removed), false);
  }
});

test('Dashboard 使用明確下一步，不再顯示模糊的有問題分類', () => {
  for (const action of ['選擇對應商品', '補上 7-11 門市', '建立物流單', '等待付款']) {
    assert.match(omsSource, new RegExp(action));
  }
  assert.equal(dashboardWorkSource.includes('有問題'), false);
});

test('訂單工作台與 Dashboard 使用同一組互斥工作階段', () => {
  for (const label of ['待確認', '等待中', '可出貨', '待交寄']) {
    assert.match(ordersPageSource, new RegExp(label));
  }
  assert.equal(ordersPageSource.includes('有問題'), false);
  for (const removed of ['今天需要處理', 'OMS 篩選只包含', '點選卡片即可', '種類']) {
    assert.equal(ordersPageSource.includes(removed), false);
  }
  assert.match(ordersPageSource, /來源：/);
  assert.match(ordersPageSource, /同步與管理/);
});
