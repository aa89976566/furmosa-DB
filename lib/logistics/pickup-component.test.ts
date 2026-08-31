import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as ui from './pickup-search-ui';

// Execute real component handlers with mocked hooks and XHR, without network or credentials.
function harness() {
  let state = ui.initialSearchState, query = '', refIndex = 0;
  const refs = [{ current: 0 }, { current: null }] as any[];
  const requests: FakeXHR[] = [];
  class FakeXHR {
    url = ''; status = 0; responseText = ''; timeout = 0; aborted = false;
    onload = () => {}; onerror = () => {}; ontimeout = () => {};
    open(method: string, url: string) { assert.equal(method, 'GET'); this.url = url; }
    send() { requests.push(this); }
    abort() { this.aborted = true; }
    reply(status: number, body: unknown) { this.status = status; this.responseText = JSON.stringify(body); this.onload(); }
  }
  const exports: any = {};
  const jsx = (type: unknown, props: any) => ({ type, props });
  const source = readFileSync('components/logistics/pickup-search-preview.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Script(compiled).runInContext(createContext({ exports, XMLHttpRequest: FakeXHR, require: (name: string) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useState: () => [query, (value: string) => { query = value; }],
      useReducer: () => [state, (action: ui.SearchAction) => { state = ui.searchReducer(state, action); }],
      useRef: () => refs[refIndex++], useEffect: () => {},
    };
    if (name === '@/lib/logistics/pickup-search-ui') return ui;
    if (name === '@/components/ui/button') return { Button: 'button' };
    if (name === '@/components/ui/input') return { Input: 'input' };
    throw new Error('Unexpected dependency: ' + name);
  } }));
  function find(predicate: (node: any) => boolean) {
    refIndex = 0;
    const root = exports.PickupSearchPreview({ enabled: true });
    function walk(node: any): any {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const item of node) { const hit = walk(item); if (hit) return hit; } return; }
      if (predicate(node)) return node;
      return walk(node.props?.children);
    }
    const found = walk(root); assert.ok(found); return found.props;
  }
  return {
    state: () => state, requests,
    edit: (value: string) => find(n => n.props?.id === 'pickup-query').onChange({ target: { value } }),
    search: () => find(n => n.type === 'form').onSubmit({ preventDefault() {} }),
    select: (id: string) => find(n => n.props?.type === 'radio' && n.props.value === id).onChange(),
  };
}
const store = { id: '001', name: '測試店', address: '測試地址', serviceType: 'UNIMART' };
test('component waits for canonical selection and clears stale requests after editing', () => {
  const h = harness(); h.edit('測試'); h.search();
  h.requests[0].reply(200, { stores: [store] }); h.select(store.id);
  assert.match(h.requests[1].url, /storeId=001/);
  assert.equal(h.state().selected, null); assert.equal(h.state().status, 'verifying');
  h.requests[1].reply(200, { store: { ...store, address: '更新地址' } });
  assert.equal(h.state().selected?.address, '更新地址');
  h.select(store.id); h.edit('其他');
  assert.equal(h.requests[2].aborted, true);
  h.requests[2].reply(200, { store });
  assert.equal(h.state().selected, null); assert.equal(h.state().status, 'idle');
});
test('component clears selection on network failure and unavailable store', () => {
  for (const fail of ['network', 'timeout', 'unavailable']) {
    const h = harness(); h.edit('測試'); h.search(); h.requests[0].reply(200, { stores: [store] }); h.select(store.id);
    if (fail === 'network') h.requests[1].onerror();
    else if (fail === 'timeout') h.requests[1].ontimeout();
    else h.requests[1].reply(409, {});
    assert.equal(h.state().selected, null); assert.equal(h.state().status, 'error');
    assert.equal(h.state().stores.length, 0);
  }
});
