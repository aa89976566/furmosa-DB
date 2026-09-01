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

test('訂單桌面列表只保留五個營運欄位', () => {
  const headers = [...listSource.matchAll(/<TableHead[^>]*>([^<]+)<\/TableHead>/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  assert.deepEqual(headers.slice(0, 5), ['訂單／客戶', '商品', '配送', '金額', '下一步']);
  assert.equal(headers.includes('幣別'), false);
  assert.equal(headers.includes('店家'), false);
});

test('列表與詳細頁的既有客戶姓名都連到 CRM 主鍵', () => {
  assert.match(listSource, /href=\{`\/customers\/\$\{o\.customer\.id\}`\}/);
  assert.match(detailSource, /href=\{`\/customers\/\$\{order\.customer\.id\}`\}/);
});

test('訂單詳細頁使用四個營運區塊並隱藏進階工具', () => {
  for (const label of ['1. 訂單處理', '2. 商品內容', '3. 收件與配送', '4. 金額與處理紀錄']) {
    assert.match(detailSource, new RegExp(label.replace('.', '\\.')));
  }
  assert.match(detailSource, /更多管理工具/);
  assert.match(detailSource, /固定以新台幣顯示/);
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
    assert.match(dashboardWorkSource, new RegExp(action));
  }
  assert.equal(dashboardWorkSource.includes('有問題'), false);
});
