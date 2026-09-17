import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import Module, { createRequire, register } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReviewDraft } from '../review-policy.ts';

const actionStub = { omsReviewAction: async () => ({ ok: null, action: null, message: '', omsStatus: null, blockers: [], kind: null, next: null }) };
const load = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load.bind(Module);
(Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(request: unknown, ...rest: unknown[]) {
  if (String(request).includes('oms-actions')) return actionStub;
  return load(request, ...rest);
};
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (String(specifier).includes('oms-actions')) return { shortCircuit: true, url: 'data:text/javascript,export async function omsReviewAction(){return {ok:null,action:null,message:"",omsStatus:null,blockers:[],kind:null,next:null}}' };
  return nextResolve(specifier, context);
}`)}`, import.meta.url);

type Props = {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  sourceSummary: { paymentLabel: string; paymentTone: 'ready' | 'hold' | 'danger'; total: string; currency: string; recipient: string; phone: string; address: string; shippingLabel: string; items: { title: string; quantity: string; sku: string }[] };
};
let Form: ComponentType<Props>;

async function loadForm() {
  if (!Form) {
    const require = createRequire(import.meta.url);
    const reactDom = require('react-dom') as { useFormState?: unknown; useFormStatus?: unknown };
    reactDom.useFormState = (_action: unknown, initial: unknown) => [initial, _action];
    reactDom.useFormStatus = () => ({ pending: false });
    (globalThis as typeof globalThis & { React?: unknown }).React = require('react');
    ({ OmsReviewForm: Form } = await import('../../../components/orders/oms-review-form.tsx'));
  }
  return Form;
}

test('Shopify 訂單直接呈現來源商品，HQ 只補正履約欄位', async () => {
  assert.equal(existsSync(fileURLToPath(new URL('../../../components/orders/oms-review-form.tsx', import.meta.url))), true);
  const Component = await loadForm();
  const html = renderToStaticMarkup(createElement(Component, {
    orderId: 'o1', sourceHash: 'hash', status: 'NEW',
    draft: { lines: [], method: '', temperature: '', recipient: '', phone: '', address: '', storeId: '', storeName: '', giftsConfirmed: false, duplicateConfirmed: false },
    sourceSummary: { paymentLabel: '已付款', paymentTone: 'ready', total: '357.00', currency: 'TWD', recipient: '稚媛 高', phone: '0971686321', address: '苗栗縣銅鑼鄉', shippingLabel: '7-11 取貨（店到店）', items: [{ title: '◈壕大大◈雞霸', quantity: '×3', sku: '' }] },
  }));
  assert.match(html, /◈壕大大◈雞霸/);
  assert.match(html, /7-11 取貨/);
  assert.match(html, /商品與數量仍以 Shopify 訂單為準/);
  assert.equal(html.includes('請選擇 HQ 商品'), false);
  assert.equal(html.includes('請確認溫層'), false);
  assert.equal(html.includes('name="productId"'), false);
  assert.match(html, /name="temperature"/);
  assert.match(html, /name="recipient"/);
  assert.match(html, /HQ 可補正/);
});
