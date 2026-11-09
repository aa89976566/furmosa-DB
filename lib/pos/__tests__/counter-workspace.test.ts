import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent', 'FormData']) {
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
let submitCount = 0;
const keys: string[] = [];
let submitAction: () => Promise<unknown> = async () => ({});
internal._load = (request: unknown, ...rest: unknown[]) => {
  if (String(request).includes('app/pos/actions')) return { checkoutCounterSaleAction: async (_state: unknown, data: FormData) => { keys.push(String(data.get('submissionKey'))); submitCount++; return submitAction(); } };
  if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
  if (String(request).endsWith('.module.css')) return {};
  return originalLoad(request, ...rest);
};
const { CounterApp } = require('../../../components/pos/counter-app');
test('counter adds an in-stock item and reaches confirmation', async () => {
 const container = document.getElementById('root')!;
 const root = createRoot(container);
 const item = {key:'p::t',productId:'p',tierId:'t',name:'雞霸',specLabel:'50g',unitPrice:165,stock:7,imageUrl:null,unit:'包',category:'treats',categoryLabel:'零食'};
 const button = (text:string) => Array.from(container.querySelectorAll('button')).find((b:any)=>b.textContent===text || b.getAttribute('aria-label')===text)!;
 try {
 await act(async()=>root.render(createElement(CounterApp,{storeName:'測試',items:[item],categories:[]})));
 await act(async()=>button('加入 雞霸 50g').click());
 assert.equal((container.querySelector('input[name="lines"]') as HTMLInputElement).value,JSON.stringify([{productId:'p',tierId:'t',qty:1}]));
 assert.equal((button('結帳') as HTMLButtonElement).disabled,false);
 let prevented = false;
 container.addEventListener('click', (event) => { prevented = event.defaultPrevented; });
 await act(async()=>button('結帳').click());
 assert.equal(prevented, true, 'review click must cancel the native form default');
 assert.ok(button('確認完成'));
 let finish!: (value: unknown) => void;
 submitAction = () => new Promise((resolve) => { finish = resolve; });
 const submit = () => container.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
 await act(async () => { submit(); submit(); });
 assert.match(keys[0]!, /^[0-9a-f-]{36}$/);
 assert.equal(submitCount, 1, 'rapid submissions must share one synchronous lock');
 assert.ok(button('記帳中…'));
 await act(async () => finish({ ok: true, total: 165 }));
 assert.ok(container.textContent!.includes('已收款'));
 assert.equal(container.querySelector('input[name="lines"]')!.getAttribute('value'), '[]');
 await act(async () => button('下一筆').click());
 await act(async () => button('加入 雞霸 50g').click());
 await act(async () => button('結帳').click());
 submitAction = async () => { throw new Error('connection lost after possible commit'); };
 await act(async () => { submit(); });
 assert.ok(container.textContent!.includes('請先到紀錄核對'));
 assert.equal((button('確認完成') as HTMLButtonElement).disabled, true);
 await act(async () => { submit(); });
 assert.notEqual(keys[1], keys[0], 'next ticket must use a fresh identity');
 assert.equal(submitCount, 2, 'unknown commit result must not be retried');
 } finally {await act(async()=>root.unmount());dom.window.close();}
});
