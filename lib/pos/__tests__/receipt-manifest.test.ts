import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import { receiptErrorMessage, RECEIPT_UNKNOWN_RESULT, type ReceiptFeedback } from '../receipt-feedback';

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
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'showModal', { value() { this.open = true; } });
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'close', { value() { this.open = false; } });
const submitted: FormData[] = [];
let resolveResult: (result: ReceiptFeedback) => void;
let navigationFails = false;
const navigations: string[] = [];
const internal = Module as typeof Module & { _load: (...args: unknown[]) => unknown };
const original = internal._load.bind(Module);
internal._load = (request: unknown, ...rest: unknown[]) => {
  if (request === './actions') return {
    confirmDirectShipmentReceiptWithFeedback: (data: FormData) => {
      submitted.push(data);
      return new Promise<ReceiptFeedback>(resolve => { resolveResult = resolve; });
    },
  };
  if (request === 'next/navigation') return { useRouter: () => ({ push(href: string) {
    navigations.push(href);
    if (navigationFails) throw new Error('navigation unavailable');
  } }) };
  return original(request, ...rest);
};
const { ReceiptManifest } = require('../../../app/pos/shipments/[id]/receipt-manifest');
internal._load = original;
const items = [{ id: 'i1', productName: '驗收雞肉', quantity: 2, sku: 'E2E', weightGrams: 30, unit: '包' }];

test('receipt requires checks, blocks duplicate submits, retains checks after failure, and locks committed receipt', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(ReceiptManifest, { shipmentId: 's1', items, canConfirmReceipt: true })));
    const checkbox = () => container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const submit = () => container.querySelector('button[type="submit"]') as HTMLButtonElement;
    const form = () => container.querySelector('form') as HTMLFormElement;
    assert.equal(submit().disabled, true);
    await act(async () => checkbox().click());
    assert.equal(submit().disabled, false);
    await act(async () => {
      form().requestSubmit();
      form().dispatchEvent(new dom.window.SubmitEvent('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].get('shipmentId'), 's1');
    assert.equal(submit().disabled, true);
    assert.equal(checkbox().disabled, true);
    await act(async () => resolveResult!({ status: 'error', message: '出貨狀態已變更' }));
    assert.equal(checkbox().checked, true);
    assert.equal(submit().disabled, false);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    assert.equal(dialog.open, true);
    assert.match(dialog.textContent!, /出貨狀態已變更/);
    await act(async () => (dialog.querySelector('button') as HTMLButtonElement).click());
    assert.equal(dialog.open, false);
    await act(async () => form().requestSubmit());
    assert.equal(submitted.length, 2);
    navigationFails = true;
    await act(async () => resolveResult!({ status: 'success', href: '/pos/shipments/s1?receipt=just_received' }));
    assert.equal(submit().disabled, true, 'post-commit navigation failure must not unlock receipt');
    assert.equal(checkbox().disabled, true);
    assert.equal(dialog.open, false, 'committed stock must not be described as failed');
    assert.match(container.textContent!, /收貨結果已確認/);
    assert.equal(navigations.length, 1);
    await act(async () => form().dispatchEvent(new dom.window.SubmitEvent('submit', { bubbles: true, cancelable: true })));
    assert.equal(submitted.length, 2);
  } finally { await act(async () => root.unmount()); }
});

test('unshipped manifest cannot submit; internal errors stay private', async () => {
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(createElement(ReceiptManifest, { shipmentId: 's1', items, canConfirmReceipt: false })));
    assert.equal(document.querySelector('form'), null);
    assert.equal((document.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled, true);
    assert.equal(receiptErrorMessage(new Error('database credentials')), RECEIPT_UNKNOWN_RESULT);
    assert.equal(receiptErrorMessage(new Error('出貨狀態已變更')), '出貨狀態已變更');
  } finally { await act(async () => root.unmount()); }
});
