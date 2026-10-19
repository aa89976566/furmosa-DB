import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import type { ReviewDraft } from '../review-policy';

// Exercise React 19's real form action/reset lifecycle; a static render misses this bug.
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLFormElement', 'HTMLInputElement', 'Event', 'MouseEvent', 'FormData']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const React = require('react');
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement } = React;
const { createRoot } = require('react-dom/client');
const submissions: Record<string, FormDataEntryValue>[] = [];
const navigation: string[] = [];
let outcome: 'check' | 'blocked' | 'ship' = 'check';
const actionStub = {
  omsReviewAction: async (_previous: unknown, form: FormData) => {
    submissions.push(Object.fromEntries(form.entries()));
    return {
      ok: outcome !== 'blocked', action: outcome === 'ship' ? 'ship' : form.get('action'),
      omsStatus: outcome === 'ship' ? 'FULFILLMENT_PENDING' : 'REVIEW',
      message: outcome === 'blocked' ? '請確認重複訂單' : '檢查通過',
      blockers: outcome === 'blocked' ? ['請確認重複訂單'] : [],
      kind: outcome === 'blocked' ? 'blocked' : 'success',
      next: outcome === 'ship' ? { label: '前往運輸區', href: '/shipments?s=test' } : null,
    };
  },
};
const internal = Module as typeof Module & { _load: (...args: unknown[]) => unknown };
const originalLoad = internal._load.bind(Module);
internal._load = (request: unknown, ...rest: unknown[]) => {
  if (String(request).includes('oms-actions')) return actionStub;
  if (request === 'next/navigation') return { useRouter: () => router };
  return originalLoad(request, ...rest);
};
const router = { refresh() {}, push(href: string) { navigation.push(href); } };
const { OmsReviewForm } = require('../../../components/orders/oms-review-form');
const draft: ReviewDraft = {
  lines: [], method: '', temperature: 'ambient', recipient: '測試收件人', phone: '0912345678',
  address: '測試門市地址', storeId: '123456', storeName: '測試門市',
  giftsConfirmed: false, duplicateConfirmed: false,
};
const sourceSummary = {
  paymentLabel: '已付款', paymentTone: 'ready', total: '165', currency: 'TWD',
  recipient: draft.recipient, phone: draft.phone, address: draft.address, shippingLabel: '', items: [],
};

test('review retains shipping selection through repeated checks and approval', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const field = (name: string) => container.querySelector(`[name="${name}"]`) as HTMLInputElement;
  const submit = async (value: string) => {
    const button = container.querySelector(`button[value="${value}"]`) as HTMLButtonElement;
    assert.ok(button);
    assert.equal((container.querySelector('form') as HTMLFormElement).checkValidity(), true);
    await act(async () => {
      (container.querySelector('form') as HTMLFormElement).requestSubmit(button);
    });
  };
  try {
    for (const method of ['convenience', 'home']) {
      submissions.length = 0;
      navigation.length = 0;
      await act(async () => root.render(createElement(OmsReviewForm, {
        key: method, orderId: 'test-order', sourceHash: 'same-source', status: 'REVIEW', draft, sourceSummary,
      })));
      await act(async () => {
        field('method').value = method;
        field('method').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
        field('address').value = 'HQ 補正地址';
      });
      outcome = 'check';
      await submit('check');
      assert.equal(submissions[0].method, method);
      assert.equal(field('method').value, method, 'React action must not reset method to 請選擇');
      assert.equal(field('address').value, 'HQ 補正地址', 'HQ corrections must survive a completed action');

      outcome = 'blocked';
      await submit('approve');
      assert.equal(field('method').value, method, 'blocked approval must preserve shipping');
      assert.equal(field('address').value, 'HQ 補正地址');
      outcome = 'check';
      await submit('check');
      assert.equal(field('method').value, method, 'checking again must not restart the selection loop');
      outcome = 'ship';
      await submit('approve');
      assert.equal(submissions.length, 4, 'all actions must reach the server action');
      assert.ok(submissions.every(row => row.method === method && row.address === 'HQ 補正地址'));
      assert.deepEqual(navigation, ['/shipments?s=test']);
    }
  } finally {
    await act(async () => root.unmount());
    internal._load = originalLoad;
    dom.window.close();
  }
});
