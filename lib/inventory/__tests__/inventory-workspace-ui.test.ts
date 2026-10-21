import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import type { InventoryRow } from '../workbench';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
for (const key of ['window', 'self', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent', 'FormData'])
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const React = require('react');
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement } = React;
const { createRoot } = require('react-dom/client');
const submissions: FormData[] = [];
const internal = Module as typeof Module & { _load: (...args: any[]) => any };
const originalLoad = internal._load.bind(Module);
internal._load = (request, ...rest) => {
  if (request.includes('quantity-actions')) return { saveInventoryQuantities: async (form: FormData) => { submissions.push(form); return { ok: true, message: '已更新' }; } };
  if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
  return originalLoad(request, ...rest);
};
const { InventoryWorkbench } = require('../../../app/(main)/inventory/inventory-workbench');
const base: InventoryRow = { id: 'bulk', name: '雞肉', sku: 'SOURCE-01', hqSku: 'HQ-01', productCode: 'P1', vendorId: null, vendorName: '', category: 'food',
  quantity: 400, unit: 'g', version: '2026-10-21T09:00:00.000Z', canCount: true, otherWarehouses: [] };
const rows = [base, { ...base, id: 'pack', name: 'QiQi凍乾', vendorId: 'qiqi', vendorName: 'QiQi', quantity: 3, unit: '包' },
  { ...base, id: 'unknown', name: '待核對', quantity: null, unit: null, canCount: false }];
test('staff filter, cancel, review and save counts with original version; refresh never rewrites a draft baseline', async () => {
  const container = document.getElementById('root')!; const root = createRoot(container);
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b: any) => b.textContent === text) as HTMLButtonElement;
  const click = async (text: string) => { assert.ok(button(text), text); await act(async () => button(text).click()); };
  const input = () => container.querySelector('input[aria-label="雞肉實際剩餘數量（g）"]') as HTMLInputElement;
  const fill = async (value: string) => { await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }); };
  try {
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: true })));
    await click('廠商成品'); assert.ok(container.textContent!.includes('QiQi凍乾')); assert.equal(container.textContent!.includes('SOURCE-01'), true);
    assert.equal(container.querySelectorAll('a[href="/products/bulk"]').length, 0);
    await click('全部庫存'); await click('盤點數量'); await fill('350'); await click('取消'); assert.equal(submissions.length, 0);
    await click('盤點數量'); await fill('350');
    await act(async () => root.render(createElement(InventoryWorkbench, { rows: rows.map(r => ({ ...r, quantity: 999, version: '2026-10-21T10:00:00.000Z' })), canEdit: true })));
    assert.equal(input().value, '350');
    await click('核對變更'); assert.ok(container.textContent!.includes('400 →')); assert.equal(submissions.length, 0);
    await click('確認更新'); assert.equal(submissions.length, 1);
    const payload = JSON.parse(submissions[0].get('lines') as string);
    assert.deepEqual(payload, [{ productId: 'bulk', quantity: '350', expectedVersion: base.version }]);
    assert.equal(submissions[0].has('date'), false); assert.equal(submissions[0].has('cost'), false);
    assert.equal(submissions[0].get('reason'), '例行實體盤點');
  } finally { await act(async () => root.unmount()); internal._load = originalLoad; dom.window.close(); }
});
