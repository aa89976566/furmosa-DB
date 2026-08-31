import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoreList, searchStores } from './store-search';
const row = { StoreId: '001234', StoreName: '示範門市', StoreAddr: '臺北市信義區示範路1號' };
const payload = { RtnCode: 1, StoreList: [{ CvsType: 'UNIMART', StoreInfo: [row] }] };
const directory = { stores: parseStoreList(payload, 'UNIMART'), fetchedAt: 1000 };
const options = { temperature: 'ambient' as const, now: 2000, frozenServiceConfirmed: false };
test('preserves leading zeroes and normalizes 台/臺 and spaces', () => {
  assert.equal(searchStores(directory, ' 台北  示範 ', options)[0].id, '001234');
});
test('empty and unknown searches do not fabricate stores', () => {
  assert.deepEqual(searchStores(directory, '', options), []);
  assert.deepEqual(searchStores(directory, '不存在', options), []);
});
test('provider errors and malformed rows are rejected', () => {
  assert.throws(() => parseStoreList({ RtnCode: 0 }, 'UNIMART'));
  assert.throws(() => parseStoreList({ ...payload, StoreList: [{ CvsType: 'UNIMART', StoreInfo: [null] }] }, 'UNIMART'));
});
test('unknown frozen service fails closed', () => {
  assert.throws(() => searchStores(directory, '示範', { ...options, temperature: 'frozen' }));
});
test('frozen search never falls back to ambient stores', () => {
  assert.deepEqual(searchStores(directory, '示範', { ...options, temperature: 'frozen', frozenServiceConfirmed: true }), []);
});
test('stale and future timestamps fail closed', () => {
  assert.throws(() => searchStores(directory, '示範', { ...options, now: 90000000 }));
  assert.throws(() => searchStores(directory, '示範', { ...options, now: 0 }));
});
test('conflicting store IDs are rejected, identical duplicates collapse', () => {
  const make = (rows: unknown[]) => ({ RtnCode: 1, StoreList: [{ CvsType: 'UNIMART', StoreInfo: rows }] });
  assert.equal(parseStoreList(make([row, row]), 'UNIMART').length, 1);
  assert.throws(() => parseStoreList(make([row, { ...row, StoreAddr: '其他地址' }]), 'UNIMART'));
});
test('limits returned results to 20 and rejects long queries', () => {
  const stores = Array.from({ length: 25 }, (_, i) => ({ ...directory.stores[0], id: String(i) }));
  assert.equal(searchStores({ ...directory, stores }, '示範', options).length, 20);
  assert.throws(() => searchStores(directory, 'a'.repeat(81), options));
});
