import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
const React = require('react');
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement } = React;
const { createRoot } = require('react-dom/client');
const internal = Module as typeof Module & { _load: (...args: unknown[]) => unknown };
const originalLoad = internal._load.bind(Module);
internal._load = (request: unknown, ...rest: unknown[]) => {
  if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }: any) => createElement('a', props, children) };
  return originalLoad(request, ...rest);
};
const { QueryBoard } = require('../../../components/pos/query-board');
test('record filter opens, filters actual rows, synchronizes tabs and clears filters', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b: any) => b.textContent === text || b.getAttribute('aria-label') === text) as HTMLButtonElement;
  const rows = ['sale', 'stock'].map((kind) => ({ id: kind, kind, at: '2026-11-05T10:00:00Z', whenLabel: '今天', dateLabel: '今天', title: kind === 'sale' ? '銷售商品' : '盤點商品', subtitle: '', status: '完成', href: '/pos/records', searchText: '' }));
  try {
    await act(async () => root.render(createElement(QueryBoard, { items: rows, todayDateLabel: '今天' })));
    assert.equal(button('篩選紀錄').getAttribute('aria-expanded'), 'false');
    await act(async () => button('篩選紀錄').click());
    assert.equal(button('篩選紀錄').getAttribute('aria-expanded'), 'true');
    const select = container.querySelector('select')!;
    await act(async () => { select.value = 'sale'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.ok(container.textContent!.includes('銷售商品'));
    assert.ok(!container.textContent!.includes('盤點商品'));
    assert.equal(button('銷售').getAttribute('aria-selected'), 'true');
    await act(async () => button('清除篩選').click());
    assert.equal(select.value, 'all');
    assert.ok(container.textContent!.includes('盤點商品'));
    await act(async () => button('收起篩選').click());
    assert.equal(container.querySelector('select'), null);
    assert.equal(button('篩選紀錄').getAttribute('aria-expanded'), 'false');
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
