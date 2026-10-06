import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { incompatibleLineSwitchPrompt, splitLinesForContext } from '../order-mode-switch';
import { validateOrderSubmission, type OrderSubmissionDraft } from '../validate-order-submission';

const standard = {
  productCategory: 'STANDARD',
  consignmentEnabled: true,
  wholesaleEnabled: true,
  jarExchangeEnabled: false,
};
const jar = {
  productCategory: 'JAR_EXCHANGE',
  consignmentEnabled: false,
  wholesaleEnabled: false,
  jarExchangeEnabled: true,
};

const formSource = readFileSync(
  new URL('../../../app/(main)/orders/new/order-form.tsx', import.meta.url),
  'utf8',
);
const editSource = readFileSync(
  new URL('../../../app/(main)/orders/[id]/edit/page.tsx', import.meta.url),
  'utf8',
);
const actionSource = readFileSync(
  new URL('../../../app/(main)/orders/actions.ts', import.meta.url),
  'utf8',
);

function draft(overrides: Partial<OrderSubmissionDraft> = {}): OrderSubmissionDraft {
  return {
    orderType: 'customer',
    customerId: 'customer_1',
    merchantId: '',
    merchantOrderMode: '',
    items: [{ productId: 'product_1', quantity: 2 }],
    discount: 0,
    recipientName: '王小明',
    recipientPhone: '0912000000',
    shippingMethod: 'home',
    shippingAddress: '台北市中山區',
    cvsBrand: '',
    cvsStoreName: '',
    ...overrides,
  };
}

test('寄賣與換罐不相容的商品要先標出來，相容商品與空白列保留', () => {
  const items = [
    { productId: 'tea', quantity: 2 },
    { productId: 'jar', quantity: 1 },
    { productId: '', quantity: 1 },
  ];
  const products = new Map([
    ['tea', standard],
    ['jar', jar],
  ]);
  const switched = splitLinesForContext(items, (id) => products.get(id), {
    orderType: 'merchant',
    merchantOrderMode: 'jar_exchange',
  });
  assert.deepEqual(switched.removed.map((item) => item.productId), ['tea']);
  assert.deepEqual(switched.kept.map((item) => item.productId), ['jar', '']);

  const unchanged = splitLinesForContext(
    [{ productId: 'tea', quantity: 2 }, { productId: '', quantity: 1 }],
    (id) => products.get(id),
    { orderType: 'merchant', merchantOrderMode: 'consignment' },
  );
  assert.deepEqual(unchanged.removed, []);
  assert.equal(unchanged.kept.length, 2);
});

test('複製或修改送出前，缺商品、數量或配送不能當成已儲存', () => {
  assert.equal(validateOrderSubmission(draft()), null);
  assert.match(validateOrderSubmission(draft({ items: [{ productId: '', quantity: 1 }] })) ?? '', /至少要有一筆商品/);
  assert.match(validateOrderSubmission(draft({ items: [{ productId: 'product_1', quantity: 0 }] })) ?? '', /數量/);
  assert.match(validateOrderSubmission(draft({ shippingMethod: '' })) ?? '', /物流方式/);
  assert.match(validateOrderSubmission(draft({ recipientName: '  ' })) ?? '', /收件人姓名/);
  assert.equal(validateOrderSubmission(draft({
    orderType: 'merchant',
    customerId: '',
    merchantId: 'merchant_1',
    merchantOrderMode: 'consignment',
  })), null);
});

test('修改頁對未出貨訂單使用可編輯表單，已鎖定時改顯示唯讀明細', () => {
  assert.match(editSource, /<OrderForm/);
  assert.match(editSource, /此訂單為唯讀/);
  assert.match(editSource, /數量 \{item\.quantity\}/);
  assert.match(editSource, /isOrderEditable\(order\)/);
});

test('複製與修改都有固定底部送出，類型切換必須先確認', () => {
  assert.match(formSource, /sticky bottom-0/);
  assert.match(formSource, /尚未建立訂單。這個畫面不會自動儲存/);
  assert.match(formSource, /修改還沒寫入/);
  assert.match(formSource, /validateOrderSubmission/);
  assert.match(formSource, /incompatibleLineSwitchPrompt/);
  assert.match(formSource, /role="dialog"/);
  assert.match(incompatibleLineSwitchPrompt('換罐計畫', 2), /取消會保留目前的商品與表單內容/);
  assert.match(formSource, /setPendingSwitch\(null\)/);
  assert.equal(formSource.includes('localStorage'), false);
  assert.match(formSource, /aria-label="數量"/);
});

test('更新訂單會拒絕已出貨，並寫回商品數量、配送與運費', () => {
  const source = actionSource.slice(actionSource.indexOf('export async function updateOrder'));
  assert.match(source, /fulfillmentStatus: true/);
  assert.match(source, /shipments: \{ select: \{ status: true \} \}/);
  assert.match(source, /if \(!editable\.ok\) throw new Error\(editable\.reason\)/);
  assert.match(source, /quantity: it\.quantity/);
  assert.match(source, /shippingFee: payload\.shippingFee/);
  assert.match(source, /shippingMethod: payload\.shippingMethod/);
  assert.match(source, /return \{ ok: true, href: withOrderSavedNotice/);
  assert.doesNotMatch(source, /redirect\(/);
});
