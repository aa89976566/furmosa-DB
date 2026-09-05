import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../../../app/(main)/orders/actions.ts', import.meta.url), 'utf8');
const formSource = readFileSync(new URL('../../../app/(main)/orders/new/order-form.tsx', import.meta.url), 'utf8');

test('建立訂單的編號查詢與寫入使用同一筆資料庫交易', () => {
  assert.match(actionSource, /nextOrderNumber\(tx: Prisma\.TransactionClient\)/);
  assert.match(actionSource, /nextShipmentNumber\(tx: Prisma\.TransactionClient\)/);
  assert.match(actionSource, /pg_advisory_xact_lock/);
  const source = actionSource.slice(actionSource.indexOf('export async function createOrder'), actionSource.indexOf('export async function updateOrder'));
  assert.doesNotMatch(source, /await nextOrderNumber\(\)/);
  assert.doesNotMatch(source, /await nextShipmentNumber\(\)/);
  assert.match(source, /await nextOrderNumber\(tx\)/);
  assert.match(source, /await nextShipmentNumber\(tx\)/);
});

test('建立失敗回傳可呈現的結果，表單以頁內訊息保留輸入內容', () => {
  assert.match(actionSource, /\{ ok: false; message: string \}/);
  assert.match(actionSource, /return \{ ok: true, orderId: created\.id \}/);
  assert.match(formSource, /role="alert"/);
  assert.match(formSource, /您已填寫的內容仍保留在畫面上/);
  assert.match(formSource, /router\.push\(`\/orders\/\$\{result\.orderId\}`\)/);
});
