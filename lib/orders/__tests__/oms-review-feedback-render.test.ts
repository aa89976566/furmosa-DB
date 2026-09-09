import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import Module, { createRequire, register } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultReviewDraft, reviewLineDisplays } from '../review-defaults.ts';
import type { ReviewDraft } from '../review-policy.ts';
import { emptyReviewResult, type ReviewResult } from '../review-service.ts';
import type { Snapshot } from '../../shopify/intake-policy.ts';

const actionStub = { omsReviewAction: async () => emptyReviewResult() };
const load = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load.bind(Module);
(Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(request: unknown, ...rest: unknown[]) {
  if (String(request).includes('oms-actions')) return actionStub;
  return load(request, ...rest);
};
const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (String(specifier).includes('oms-actions')) {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function omsReviewAction(){return {ok:null,action:null,message:"",omsStatus:null,blockers:[],kind:null,next:null}}',
    };
  }
  return nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
assert.equal(existsSync(fileURLToPath(new URL('../../../components/orders/oms-review-form.tsx', import.meta.url))), true);

type FormProps = {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  products: { id: string; name: string; sku: string; sourceSku: string | null; defaultTemperature: string }[];
  lineDisplays: ReturnType<typeof reviewLineDisplays>;
  sourceSummary: {
    paymentLabel: string;
    paymentTone: 'ready' | 'hold' | 'danger';
    financialStatus: string;
    total: string;
    currency: string;
    recipient: string;
    phone: string;
    address: string;
    shippingLabel: string;
  };
};
let Form: ComponentType<FormProps>;
let injected: ReviewResult = emptyReviewResult();

async function loadForm() {
  if (!Form) {
    const require = createRequire(import.meta.url);
    const reactDom = require('react-dom') as { useFormState?: unknown; useFormStatus?: unknown };
    reactDom.useFormState = () => [injected, async () => injected];
    reactDom.useFormStatus = () => ({ pending: false, data: null, method: null, action: null });
    (globalThis as typeof globalThis & { React?: unknown }).React = require('react');
    ({ OmsReviewForm: Form } = await import('../../../components/orders/oms-review-form.tsx'));
  }
  return Form;
}

const products = [{ id: 'p1', name: '冷凍商品', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' }];
const sourceSummary: FormProps['sourceSummary'] = {
  paymentLabel: '已付款', paymentTone: 'ready', financialStatus: 'paid', total: '100.00', currency: 'TWD',
  recipient: '王小明', phone: '0912345678', address: '台北市測試路 1 號', shippingLabel: '黑貓冷凍宅配',
};

function snapshot(): Snapshot {
  return { schemaVersion: 1, order: {
    id: '1', name: '#1', currency: 'TWD', total_price: '100.00',
    shipping_address: { name: '王小明', phone: '0912345678', city: '台北市', address1: '測試路 1 號' },
    line_items: [{ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 1, price: '100.00' }],
    shipping_lines: [{ code: 'BLACKCAT_FROZEN', title: '黑貓冷凍宅配' }],
    note_attributes: [],
  } as never };
}

function htmlFor(status = 'REVIEW') {
  const source = snapshot();
  const draft = defaultReviewDraft(source, products);
  return renderToStaticMarkup(createElement(Form, {
    orderId: 'o1', sourceHash: 'hash', status, draft, products, sourceSummary,
    lineDisplays: reviewLineDisplays(source, products, draft, null),
  }));
}

test('初始 ok=null 不渲染結果框或 CTA', async () => {
  await loadForm();
  injected = emptyReviewResult();
  const html = htmlFor();
  assert.equal(html.includes('已確認訂單'), false);
  assert.equal(html.includes('href="#oms-shipping"'), false);
  assert.equal(html.includes('尚待條件'), false);
  assert.equal(html.includes('role="alert"'), false);
  assert.match(html, /role="status" aria-live="polite"/);
});

test('approve success 顯示 CTA 且不是 alert', async () => {
  await loadForm();
  injected = emptyReviewResult({
    ok: true, action: 'approve', message: '已確認訂單', omsStatus: 'READY',
    kind: 'success', next: { label: '前往運送資訊', href: '#oms-shipping' },
  });
  const html = htmlFor('READY');
  assert.match(html, /已確認訂單/);
  assert.match(html, /href="#oms-shipping"/);
  assert.match(html, /前往運送資訊/);
  assert.equal(html.includes('role="alert"'), false);
  assert.match(html, /role="status" aria-live="polite"/);
});

test('未付款 success 用 warning 尚待條件且仍是 status', async () => {
  await loadForm();
  injected = emptyReviewResult({
    ok: true, action: 'approve', message: '已確認訂單', omsStatus: 'READY',
    blockers: ['等待 Shopify 付款完成'], kind: 'success',
    next: { label: '前往運送資訊', href: '#oms-shipping' },
  });
  const html = htmlFor('READY');
  assert.match(html, /已確認訂單/);
  assert.match(html, /等待 Shopify 付款完成/);
  assert.match(html, /尚待條件/);
  assert.match(html, /border-warning\/40/);
  assert.equal(html.includes('role="alert"'), false);
  assert.match(html, /role="status" aria-live="polite"/);
});

test('blocked 使用 status，error 使用 alert 並列出多個 li', async () => {
  await loadForm();
  injected = emptyReviewResult({
    ok: false, action: 'approve', message: '請先儲存並檢查目前版本',
    kind: 'blocked',
  });
  const blocked = htmlFor();
  assert.match(blocked, /請先儲存並檢查目前版本/);
  assert.match(blocked, /role="status" aria-live="polite"/);
  assert.equal(blocked.includes('role="alert"'), false);
  assert.equal(blocked.includes('href="#oms-shipping"'), false);

  injected = emptyReviewResult({
    ok: false, action: 'ship', message: '訂單未確認',
    blockers: ['缺少收件人', '缺少收件地址／門市地址'], kind: 'error',
  });
  const failed = htmlFor();
  assert.match(failed, /role="alert"/);
  assert.equal((failed.match(/<li>/g) ?? []).length, 2);
  assert.match(failed, /缺少收件人/);
  assert.match(failed, /缺少收件地址／門市地址/);
  assert.equal(failed.includes('href="#oms-shipping"'), false);
});

test('READY 狀態顯示建立 HQ 出貨單按鈕', async () => {
  await loadForm();
  injected = emptyReviewResult();
  const html = htmlFor('READY');
  assert.match(html, /建立 HQ 出貨單/);
  assert.match(html, /value="ship"/);
});
