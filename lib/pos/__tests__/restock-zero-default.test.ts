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
const reactDom = require('react-dom');
reactDom.useFormState = (_action: unknown, initial: unknown) => [initial, _action];
reactDom.useFormStatus = () => ({ pending: false });
const internal = Module as typeof Module & { _load: (...args: unknown[]) => unknown };
const originalLoad = internal._load.bind(Module);
internal._load = (request: unknown, ...rest: unknown[]) => {
  if (String(request).includes('app/pos/restock/actions')) return { submitSelfSelectRestockAction: async () => ({}) };
  return originalLoad(request, ...rest);
};
const { RestockPicker } = require('../../../components/pos/restock-picker');
test('unselected products start at zero and do not block submission on variant validation', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const products = [
    { id: 'duck', name: '鴨肺', unit: '包', stockQty: 0, suggestedQty: 6, priceTiers: [{ id: '30', weightGrams: 30 }, { id: '50', weightGrams: 50 }] },
    { id: 'gold', name: '黃金條', unit: '包', stockQty: 0, suggestedQty: 6, priceTiers: [{ id: 'g30', weightGrams: 30 }] },
  ];
  const button = (label: string) => Array.from(container.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === label || b.textContent === label)!;
  try {
    await act(async () => root.render(createElement(RestockPicker, { products })));
    assert.deepEqual(Array.from(container.querySelectorAll('span.tabular-nums')).map(e => e.textContent), ['0', '0']);
    assert.match(container.textContent!, /建議補 6/);
    await act(async () => button('黃金條 增加').click());
    assert.equal(button('確認寄賣叫貨').disabled, false);
    await act(async () => button('鴨肺 增加').click());
    assert.equal(button('請先選擇商品規格').disabled, true);
    const select = container.querySelector('select')!;
    await act(async () => { select.value = '50'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await act(async () => button('確認寄賣叫貨').click());
    assert.equal(container.querySelectorAll('input[name="productId"]').length, 2);
    assert.equal(container.querySelector('input[name="variantKey"]')?.getAttribute('value'), '50');
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
