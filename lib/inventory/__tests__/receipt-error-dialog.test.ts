import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost'});
for (const key of ['window','self','document','HTMLElement','HTMLInputElement','Event','MouseEvent'])
  Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React = require('react');
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
const {act,createElement:h} = React;
const reactDom = require('react-dom');
const {createRoot} = require('react-dom/client');
let state = {error:'',attempt:0};
const internal = Module as typeof Module & {_load:(...args:any[])=>any};
const original = internal._load.bind(Module);
internal._load = (request,...rest) => {
  if(request==='react-dom') return {...reactDom,useFormState:()=>[state,undefined]};
  if(request==='../actions') return {createPurchaseReceipt:()=>{}};
  if(request==='@/components/ui/button') return {Button:React.forwardRef((props:any,ref:any)=>h('button',{...props,ref}))};
  return original(request,...rest);
};
const {PurchaseReceiptForm} = require('../../../app/(main)/inventory/purchases/new/purchase-receipt-form');
internal._load = original;
dom.window.HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');};
dom.window.HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');};

test('failure opens reason dialog, preserves input and submission key, and reopens for same reason on retry',async()=>{
  const host = document.getElementById('root')!;
  const root = createRoot(host);
  const render = ()=>root.render(h(PurchaseReceiptForm,null,h('input',{name:'quantityGrams',defaultValue:'100'}),h('input',{name:'submissionKey',type:'hidden',value:'same-key'})));
  try {
    await act(async()=>render());
    const input = host.querySelector('input[name="quantityGrams"]') as HTMLInputElement;
    input.value='350';
    // React may request native form reset after a server action resolves.
    await act(async()=> (host.querySelector('form') as HTMLFormElement).reset());
    assert.equal(input.value,'350');
    state={error:'片裝商品的商品單位不是 g，請先確認庫存規格',attempt:1};
    await act(async()=>render());
    assert.ok(host.querySelector('dialog[open]'));
    assert.ok(host.textContent!.includes(state.error));
    assert.equal(document.activeElement?.textContent,'知道了，返回表單');
    await act(async()=> (host.querySelector('button') as HTMLButtonElement).click());
    assert.equal(host.querySelector('dialog[open]'),null);
    assert.equal(input.value,'350');
    assert.equal((host.querySelector('input[name="submissionKey"]') as HTMLInputElement).value,'same-key');
    state={...state,attempt:2};
    await act(async()=>render());
    assert.ok(host.querySelector('dialog[open]'));
    assert.equal(input.value,'350');
  } finally {await act(async()=>root.unmount());}
});
