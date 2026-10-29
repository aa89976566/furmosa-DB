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
  if (String(request).includes('app/pos/restock/actions')) {
    return { submitSelfSelectRestockAction: async () => ({}) };
  }
  return originalLoad(request, ...rest);
};
const { RestockPicker } = require('../../../components/pos/restock-picker');

test('叫貨從零開始，建議數量僅提示，僅訂購商品需要規格', async () => {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const products = [
    { id: 'duck', name: '鴨肺', unit: '包', stockQty: 0, suggestedQty: 6,
      priceTiers: [{ id: '30', weightGrams: 30 }, { id: '50', weightGrams: 50 }] },
    { id: 'gold', name: '黃金條', unit: '包', stockQty: 2, suggestedQty: 4,
      priceTiers: [{ id: 'gold30', weightGrams: 30 }] },
  ];
  const button = (label: string) => Array.from(container.querySelectorAll('button'))
    .find(b => b.getAttribute('aria-label') === label || b.textContent === label)!;
  const click = async (label: string) => act(async () => button(label).click());
  try {
    await act(async () => root.render(createElement(RestockPicker, { products })));
    assert.deepEqual(Array.from(container.querySelectorAll('span.tabular-nums')).map(e => e.textContent), ['0', '0']);
    assert.match(container.textContent!, /建議補 6/);
    assert.match(container.textContent!, /建議補 4/);
    assert.equal(button('確認寄賣叫貨').disabled, true);
    await click('黃金條 增加');
    assert.equal(button('確認寄賣叫貨').disabled, false, '未訂購的鴨肺無須選規格');
    await click('鴨肺 增加');
    assert.equal(button('請先選擇商品規格').disabled, true);
    const select = container.querySelector('select')!;
    await act(async () => { select.value = '50'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(button('確認寄賣叫貨').disabled, false);
    await click('鴨肺 減少');
    await click('鴨肺 減少');
    await click('確認寄賣叫貨');
    assert.equal(container.querySelector('input[name="productId"]')?.getAttribute('value'), 'gold');
    assert.equal(container.querySelectorAll('input[name="productId"]').length, 1);
    assert.equal(container.querySelector('input[name="quantity"]')?.getAttribute('value'), '1');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
