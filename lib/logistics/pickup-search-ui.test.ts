import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSearchState, readSearchResponse, readSelectionResponse, searchReducer } from './pickup-search-ui';
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
  const pending = searchReducer(ready, { type: 'verify', request: 1, id: store.id });
  assert.equal(pending.selected, null);
  assert.equal(pending.status, 'verifying');
  assert.deepEqual(searchReducer(pending, { type: 'verified', request: 1, store }).selected, store);
  assert.equal(searchReducer(ready, { type: 'verify', request: 1, id: 'invalid' }), ready);
});
test('selection response must match requested ID and contain a valid ambient address', () => {
  assert.deepEqual(readSelectionResponse(200, { store }, store.id), store);
  for (const invalid of [null, { store: { ...store, id: '999' } }, { store: { ...store, address: '' } }, { store: { ...store, serviceType: 'UNIMARTFREEZE' } }]) {
    assert.throws(() => readSelectionResponse(200, invalid, store.id));
  }
  assert.throws(() => readSelectionResponse(409, null, store.id), /重新搜尋/);
  assert.throws(() => readSelectionResponse(401, null, store.id), /登入/);
  assert.throws(() => readSelectionResponse(503, null, store.id));
});
test('switching stores ignores late verification and uses canonical address', () => {
  const other = { ...store, id: '002' };
  const ready = searchReducer(initialSearchState, { type: 'result', request: 0, stores: [store, other] });
  const first = searchReducer(ready, { type: 'verify', request: 1, id: store.id });
  const second = searchReducer(first, { type: 'verify', request: 2, id: other.id });
  assert.equal(searchReducer(second, { type: 'verified', request: 1, store }), second);
  assert.equal(searchReducer(second, { type: 'verified', request: 2, store }), second);
  const canonical = { ...other, address: '伺服器更新的地址' };
  const done = searchReducer(second, { type: 'verified', request: 2, store: canonical });
  assert.deepEqual(done.selected, canonical);
  assert.deepEqual(done.stores[1], canonical);
  const reset = searchReducer(second, { type: 'reset', request: 3 });
  assert.equal(searchReducer(reset, { type: 'verified', request: 2, store: canonical }), reset);
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
