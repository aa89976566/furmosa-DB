import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const entrySource = readFileSync(
  new URL('../../../app/(main)/customers/new/page.tsx', import.meta.url),
  'utf8',
);
const customerFormSource = readFileSync(
  new URL('../../../components/customers/customer-form.tsx', import.meta.url),
  'utf8',
);
const merchantFormSource = readFileSync(
  new URL('../../../components/merchants/merchant-create-form.tsx', import.meta.url),
  'utf8',
);

test('新增入口清楚分流一般客戶與 POS 合作店家', () => {
  assert.match(entrySource, /一般客戶/);
  assert.match(entrySource, /合作店家/);
  assert.match(entrySource, /\/customers\/new\?kind=customer/);
  assert.match(entrySource, /\/merchants\/new/);
  assert.match(entrySource, /共用店家庫存、補貨與 POS/);
});

test('一般客戶新建表單精簡必填資料並收合選填內容', () => {
  assert.match(customerFormSource, /name="type" value="individual"/);
  assert.match(customerFormSource, /客戶姓名/);
  assert.match(customerFormSource, /required=\{!isEdit\}/);
  for (const section of ['LINE 資料', '常用收貨方式', '毛孩資料']) {
    assert.match(customerFormSource, new RegExp(section));
  }
  assert.match(customerFormSource, /<details/);
});

test('合作店家將店名與預設收貨人分開，並沿用 Merchant 流程', () => {
  assert.match(merchantFormSource, /店家名稱/);
  assert.match(merchantFormSource, /預設收貨人/);
  assert.match(merchantFormSource, /店家名稱與實際收貨人分開保存/);
  assert.match(merchantFormSource, /createMerchantAction/);
});
