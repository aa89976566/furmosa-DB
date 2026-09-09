import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoreList, resolveStore, searchStores } from './store-search';
const row = { StoreId: '001234', StoreName: '示範門市', StoreAddr: '臺北市信義區示範路1號' };
const payload = { RtnCode: 1, StoreList: [{ CvsType: 'UNIMART', StoreInfo: [row] }] };
const directory = { stores: parseStoreList(payload, 'UNIMART'), fetchedAt: 1000 };
const options = { temperature: 'ambient' as const, now: 2000, frozenServiceConfirmed: false };
test('exact selection preserves leading zeroes and returns a copy of canonical data', () => {
  const selected = resolveStore(directory, '001234', options)!;
  assert.deepEqual(selected, directory.stores[0]);
  selected.address = 'client modification';
  assert.equal(directory.stores[0].address, row.StoreAddr);
  assert.equal(resolveStore(directory, '1234', options), null);
  assert.equal(resolveStore(directory, '999999', options), null);
});
test('selection rejects invalid IDs, duplicate identities and stale directory', () => {
  for (const id of ['', '001234 ', '../001234', 'a'.repeat(11)]) assert.throws(() => resolveStore(directory, id, options));
  for (const now of [NaN, 0, directory.fetchedAt + 3600000]) assert.throws(() => resolveStore(directory, '001234', { ...options, now }));
  assert.throws(() => resolveStore({ ...directory, stores: [...directory.stores, ...directory.stores] }, '001234', options));
});
test('selection checks temperature and never falls back to an ambient store', () => {
  assert.throws(() => resolveStore(directory, '001234', { ...options, temperature: 'frozen' }));
  assert.equal(resolveStore(directory, '001234', { ...options, temperature: 'frozen', frozenServiceConfirmed: true }), null);
});
test('preserves leading zeroes and normalizes 台/臺 and spaces', () => {
  assert.equal(searchStores(directory, ' 台北  示範 ', options)[0].id, '001234');
});
test('finds stores by exact ID and tolerates common customer wording', () => {
  assert.equal(searchStores(directory, '001234', options)[0].id, '001234');
  assert.equal(searchStores(directory, '7-ELEVEN 示範門市', options)[0].id, '001234');
});
test('falls back from a neighborhood descriptor without returning unrelated stores', () => {
  const newBan = {
    fetchedAt: 1000,
    stores: [
      { id: '286325', name: '新板橋', address: '新北市板橋區文化路一段135號', serviceType: 'UNIMART' as const },
      { id: '110301', name: '耀心', address: '新北市板橋區中山路一段50巷22號', serviceType: 'UNIMART' as const },
    ],
  };
  assert.deepEqual(searchStores(newBan, '新板特區', options).map(store => store.id), ['286325']);
});
test('ranks an exact store name before broad address matches', () => {
  const stores = [
    { id: '002', name: '其他', address: '新北市示範區示範路2號', serviceType: 'UNIMART' as const },
    { id: '001', name: '示範', address: '新北市其他區1號', serviceType: 'UNIMART' as const },
  ];
  assert.equal(searchStores({ fetchedAt: 1000, stores }, '示範', options)[0].id, '001');
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
test('every store in a large directory is searchable without manual spot checks', () => {
  const stores = Array.from({ length: 500 }, (_, i) => ({
    id: String(100000 + i),
    name: `批次驗證${i}`,
    address: `台灣測試市第${i}區完整路${i}號`,
    serviceType: 'UNIMART' as const,
  }));
  const largeDirectory = { fetchedAt: 1000, stores };
  for (const store of stores) {
    assert.ok(searchStores(largeDirectory, store.id, options).some(result => result.id === store.id));
    assert.ok(searchStores(largeDirectory, store.name, options).some(result => result.id === store.id));
    assert.ok(searchStores(largeDirectory, `${store.name}門市`, options).some(result => result.id === store.id));
  }
});
