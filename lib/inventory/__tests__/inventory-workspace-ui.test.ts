import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test, { after } from 'node:test';
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
dom.window.confirm = () => true;
const { createRoot } = require('react-dom/client');
const submissions: FormData[] = [];
let outcome = { ok: true, message: '已更新' };
let refreshFails = false;
let pendingResult: ((result: typeof outcome) => void) | null = null;
let holdSubmission = false;
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'showModal', { value() { this.open = true; } });
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'close', { value() { this.open = false; } });
after(() => { internal._load = originalLoad; });
const internal = Module as typeof Module & { _load: (...args: any[]) => any };
const originalLoad = internal._load.bind(Module);
internal._load = (request, ...rest) => {
  if (request.includes('quantity-actions')) return { saveInventoryQuantities: async (form: FormData) => { submissions.push(form); return holdSubmission ? new Promise<typeof outcome>(resolve => { pendingResult = resolve; }) : outcome; } };
  if (request === 'next/navigation') return { useRouter: () => ({ refresh() { if (refreshFails) throw new Error('refresh failed'); } }) };
  return originalLoad(request, ...rest);
};
const { InventoryWorkbench } = require('../../../app/(main)/inventory/inventory-workbench');
const base: InventoryRow = { id: 'bulk', name: '雞肉', sku: 'SOURCE-01', hqSku: 'HQ-01', productCode: 'P1', vendorId: null, vendorName: '', category: 'food',
  quantity: 400, unit: 'g', version: '2026-10-21T09:00:00.000Z', canCount: true, otherWarehouses: [] };
const rows = [base, { ...base, id: 'pack', name: 'QiQi凍乾', vendorId: 'qiqi', vendorName: 'QiQi', quantity: 3, unit: '包' },
  { ...base, id: 'unknown', name: '待核對', quantity: null, unit: null, canCount: false, canConfirmUnit: true }];
test('staff filter, cancel, preview differences and save counts with original version; refresh never rewrites a draft baseline', async () => {
  const container = document.getElementById('root')!; const root = createRoot(container);
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b: any) => b.textContent === text) as HTMLButtonElement;
  const click = async (text: string) => { assert.ok(button(text), text); await act(async () => button(text).click()); };
  const input = () => container.querySelector('input[aria-label="雞肉本次清點數量（g）"]') as HTMLInputElement;
  const fill = async (value: string) => { await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }); };
  try {
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: true })));
    assert.equal(container.querySelector('a[href^="/inventory/confirm-unit/"]'), null);
    assert.equal(container.textContent!.includes('核對庫存單位'), false);
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: true, canVerifyUnits: true })));
    const setup = container.querySelector('a[href="/inventory/confirm-unit/unknown"]')!;
    assert.equal(setup.closest('details'), null, 'administrator setup is accessible directly in the row');
    assert.equal(setup.textContent, '完成設定');
    const advancedSetup = container.querySelector('details a[href="/inventory/confirm-unit/unknown"]')!;
    assert.equal(advancedSetup.closest('details')!.hasAttribute('open'), false);
    assert.equal(container.querySelectorAll('a[href^="/inventory/confirm-unit/"]').length, 2);
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: true })));
    await act(async () => { const select = container.querySelector('select[aria-label="商品分類"]') as HTMLSelectElement; select.value = 'vendor'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }); assert.ok(container.textContent!.includes('QiQi凍乾')); assert.equal(container.textContent!.includes('SOURCE-01'), true);
    assert.equal(container.querySelectorAll('a[href="/products/bulk"]').length, 0);
    await act(async () => { const select = container.querySelector('select[aria-label="商品分類"]') as HTMLSelectElement; select.value = 'all'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }); await click('盤點庫存'); await fill('350'); await click('取消'); assert.equal(submissions.length, 0);
    await click('盤點庫存'); await fill('350');
    await act(async () => root.render(createElement(InventoryWorkbench, { rows: rows.map(r => ({ ...r, quantity: 999, version: '2026-10-21T10:00:00.000Z' })), canEdit: true })));
    assert.equal(input().value, '350');
    assert.ok(container.textContent!.includes('差異 -50 g')); assert.equal(submissions.length, 0);
    assert.ok(container.textContent!.includes('庫存單位尚未確認'));
    assert.ok(container.textContent!.includes('請管理員完成設定後再盤點'));
    assert.equal(container.querySelector('a[href="/inventory/confirm-unit/unknown"]'), null);
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: true, canVerifyUnits: true })));
    assert.equal(container.querySelector('a[href="/inventory/confirm-unit/unknown"]')?.textContent,'設定單位與首次庫存');
    assert.equal(container.querySelector('input[aria-label="待核對本次清點數量（null）"]'), null);
    await click('儲存盤點'); assert.equal(submissions.length, 1);
    const payload = JSON.parse(submissions[0].get('lines') as string);
    assert.deepEqual(payload, [{ productId: 'bulk', quantity: '350', expectedVersion: base.version }]);
    assert.equal(submissions[0].has('date'), false); assert.equal(submissions[0].has('cost'), false);
    assert.equal(submissions[0].get('reason'), '例行實體盤點');
  } finally { await act(async () => root.unmount()); internal._load = originalLoad; }
});


test('count failure keeps drafts, shows reason, prevents repeated clicks; committed refresh failure stays successful', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === text) as HTMLButtonElement;
  const input = () => container.querySelector('input[aria-label="雞肉本次清點數量（g）"]') as HTMLInputElement;
  const before = submissions.length;
  try {
    outcome = { ok: false, message: '雞肉的庫存已變更，請重新清點' };
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: true })));
    await act(async () => button('盤點庫存').click());
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input(), '350');
      input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    holdSubmission = true;
    await act(async () => { button('儲存盤點').click(); button('儲存盤點')?.click(); });
    assert.equal(submissions.length, before + 1);
    await act(async () => pendingResult!(outcome));
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    assert.equal(dialog.open, true);
    assert.match(dialog.textContent!, /庫存已變更/);
    assert.equal(input().value, '350');
    await act(async () => button('返回檢查').click());
    holdSubmission = false;
    refreshFails = true;
    outcome = { ok: true, message: '已更新' };
    await act(async () => button('儲存盤點').click());
    assert.equal(submissions.length, before + 2);
    assert.equal(submissions[before].get('eventKey'), submissions[before + 1].get('eventKey'));
    assert.equal(dialog.open, false);
    assert.match(container.textContent!, /盤點已儲存；畫面更新失敗/);
    assert.equal(button('盤點庫存').disabled, true, 'stale quantities cannot become a new count baseline');
    assert.ok(button('重新載入庫存'));
  } finally {
    holdSubmission = false; refreshFails = false;
    await act(async () => root.unmount());
  }
});

test('read-only staff never see count or unit administration controls', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(InventoryWorkbench, { rows, canEdit: false, canVerifyUnits: false })));
    assert.equal(container.querySelector('input[inputmode="numeric"]'), null);
    assert.equal(container.querySelector('a[href^="/inventory/confirm-unit/"]'), null);
    assert.equal(Array.from(container.querySelectorAll('button')).some(b => b.textContent === '盤點庫存'), false);
  } finally { await act(async () => root.unmount()); }
});

test('pagination and status filters keep count drafts across pages and submit every changed row', async () => {
  const container = document.getElementById('root')!; const root = createRoot(container);
  const many = Array.from({length:12},(_,i) => ({...base,id:`item-${i}`,name:`商品${i}`, status:'active'}));
  const all = [...many,{...base,id:'inactive',name:'舊停用品',status:'inactive'}, {...base,id:'negative',name:'異常負數',quantity:-5,status:'active'}, {...base,id:'empty',name:'零庫存',quantity:0,status:'active'}, rows[2]];
  const click = async (text: string) => { const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === text)!; assert.ok(button,text); await act(async () => button.click()); };
  const fill = async (name:string,value:string) => { const input = container.querySelector(`input[aria-label="${name}本次清點數量（g）"]`)!; await act(async () => {Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}); };
  try {
    await act(async () => root.render(createElement(InventoryWorkbench,{rows:all,canEdit:true,pendingCount:4})));
    assert.equal(container.querySelector('tbody')!.textContent!.includes('舊停用品'),false);
    assert.equal(container.querySelectorAll('tbody tr').length,10);
    await click('盤點庫存'); await fill('商品0','350');
    await act(async () => (container.querySelector('button[aria-label="下一頁"]') as HTMLButtonElement).click());
    await fill('商品10','300');
    await act(async () => (container.querySelector('button[aria-label="上一頁"]') as HTMLButtonElement).click());
    assert.equal((container.querySelector('input[aria-label="商品0本次清點數量（g）"]') as HTMLInputElement).value,'350');
    await click('負庫存'); assert.ok(container.textContent!.includes('異常負數')); assert.equal(container.querySelectorAll('tbody tr').length,1);
    await click('無庫存'); assert.ok(container.textContent!.includes('零庫存')); assert.equal(container.querySelectorAll('tbody tr').length,1);
    await click('已停用'); assert.ok(container.textContent!.includes('舊停用品')); assert.equal(container.querySelectorAll('input[inputmode="numeric"]').length,0);
    outcome={ok:true,message:'已更新'};const countBefore=submissions.length;
    await click('儲存盤點');assert.equal(submissions.length,countBefore+1);
    assert.deepEqual(JSON.parse(submissions.at(-1)!.get('lines') as string).map((x:any)=>x.productId),['item-0','item-10']);
  } finally { await act(async () => root.unmount()); }
});
