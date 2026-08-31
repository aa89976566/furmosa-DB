import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSearchState, readSearchResponse, searchReducer } from './pickup-search-ui';
import type { Store } from './store-search';

const store: Store = { id: '001234', name: '測試門市', address: '測試用地址', serviceType: 'UNIMART' };
test('valid results preserve leading-zero IDs and full addresses', () => {
  assert.deepEqual(readSearchResponse(200, { stores: [store] }), [store]);
});
test('unavailable and expired sessions are not empty results', () => {
  assert.throws(() => readSearchResponse(401, null), /登入/);
  assert.throws(() => readSearchResponse(503, { stores: [] }), /無法查詢/);
  assert.deepEqual(readSearchResponse(200, { stores: [] }), []);
});
test('invalid, duplicate and frozen responses fail closed', () => {
  for (const stores of [[{ ...store, address: '' }], [store, store], [{ ...store, serviceType: 'UNIMARTFREEZE' }], Array(21).fill(store)]) {
    assert.throws(() => readSearchResponse(200, { stores }));
  }
  assert.throws(() => readSearchResponse(200, '<html>login</html>'));
});
test('select only an existing result, no fabricated stores', () => {
  const ready = searchReducer(initialSearchState, { type: 'result', request: 0, stores: [store] });
  assert.deepEqual(searchReducer(ready, { type: 'select', id: store.id }).selected, store);
  assert.equal(searchReducer(ready, { type: 'select', id: 'invalid' }).selected, null);
});
test('editing search clears the previous selection and list', () => {
  const selected = { ...initialSearchState, status: 'ready' as const, stores: [store], selected: store };
  const reset = searchReducer(selected, { type: 'reset', request: 1 });
  assert.equal(reset.selected, null);
  assert.deepEqual(reset.stores, []);
});
test('late responses cannot replace a newer search', () => {
  const state = searchReducer(initialSearchState, { type: 'start', request: 2 });
  assert.equal(searchReducer(state, { type: 'result', request: 1, stores: [store] }), state);
  assert.equal(searchReducer(state, { type: 'error', request: 1, message: 'old' }), state);
});
test('network error clears results and selection', () => {
  const ready = { ...initialSearchState, status: 'ready' as const, stores: [store], selected: store };
  const failed = searchReducer(ready, { type: 'error', request: 0, message: '連線失敗' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.selected, null);
  assert.deepEqual(failed.stores, []);
});
