import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import { reviewAttentionTarget } from '../review-attention';
import type { OmsIssue } from '../oms';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><section id="oms-review"><button data-review-target="products">修改 HQ 訂單</button><div id="root"></div></section>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLFormElement', 'HTMLInputElement', 'HTMLDetailsElement', 'Event', 'MouseEvent', 'FormData']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const React = require('react');
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement } = React;
const { createRoot } = require('react-dom/client');
let writes = 0;
const internal = Module as typeof Module & { _load: (...args: unknown[]) => unknown };
const originalLoad = internal._load.bind(Module);
const router = { refresh() {}, push() {} };
internal._load = (request: unknown, ...rest: unknown[]) => {
  if (String(request).includes('review-request')) return { requestOmsReview: async () => { writes++; throw new Error('navigation must not submit'); } };
  if (request === 'next/navigation') return { useRouter: () => router };
  return originalLoad(request, ...rest);
};
const { OmsReviewForm } = require('../../../components/orders/oms-review-form');

test('attention uses stable issue codes to open the correct section and focus without saving', async () => {
  assert.equal(reviewAttentionTarget('PHONE_MISSING'), 'phone');
  assert.equal(reviewAttentionTarget('PRODUCT_UNMAPPED'), 'products');
  assert.equal(reviewAttentionTarget('ORDER_CHANGED'), 'source');
  const root = createRoot(document.getElementById('root'));
  const issue = (code: OmsIssue['code'], message: string): OmsIssue => ({ code, message, severity: 'blocking' });
  const issues = [issue('PHONE_MISSING', '請補上電話'), issue('POSSIBLE_DUPLICATE', '核對重複訂單'), issue('PRODUCT_UNMAPPED', '商品需對應'), issue('ORDER_CHANGED', '核對來源'), issue('PAYMENT_PENDING', '未付款'), issue('PHONE_MISSING', '請補上電話')];
  const props = {
    orderId: 'test', sourceHash: 'same', status: 'REVIEW', initialIssues: issues,
    draft: { lines: [], method: 'home', temperature: 'ambient', recipient: '測試', phone: '0912345678', address: '測試地址', storeId: '', storeName: '', giftsConfirmed: false, duplicateConfirmed: false },
    sourceSummary: { paymentLabel: '未付款', paymentTone: 'hold', total: '399', currency: 'TWD', recipient: '測試', phone: '0912345678', address: '測試地址', shippingLabel: '黑貓宅配' },
  };
  try {
    await act(async () => root.render(createElement(OmsReviewForm, props)));
    assert.match(document.querySelector('[aria-label="待處理提示"]')!.textContent!, /還有 4 項/);
    assert.equal(document.querySelector('[aria-label="待處理提示"]')!.textContent!.includes('未付款'), false);
    const click = async (text: string) => {
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="待處理提示"] button')).find(b => b.textContent!.startsWith(text))!;
      assert.equal(button.type, 'button');
      await act(async () => button.click());
    };
    const phone = document.querySelector<HTMLInputElement>('[name="phone"]')!;
    assert.equal(phone.closest('details')!.open, false);
    await click('請補上電話');
    assert.equal(phone.closest('details')!.open, true);
    assert.equal(document.activeElement, phone);
    await click('核對重複訂單');
    const duplicate = document.querySelector<HTMLInputElement>('[name="duplicateConfirmed"]')!;
    assert.equal(duplicate.closest('details')!.open, true);
    assert.equal(document.activeElement, duplicate);
    assert.equal(duplicate.checked, false, 'navigation cannot confirm an exception');
    await click('商品需對應');
    assert.equal(document.activeElement?.getAttribute('data-review-target'), 'products');
    await click('核對來源');
    const source = document.querySelector<HTMLDetailsElement>('[data-review-target="source"]')!;
    assert.equal(source.open, true);
    assert.equal(document.activeElement, source.querySelector('summary'));
    assert.equal(writes, 0);
    await act(async () => root.render(createElement(OmsReviewForm, { ...props, status: 'READY' })));
    assert.equal(document.querySelector('[aria-label="待處理提示"]'), null, 'confirmed orders must not display outdated editing tasks');
  } finally { await act(async () => root.unmount()); }
});
