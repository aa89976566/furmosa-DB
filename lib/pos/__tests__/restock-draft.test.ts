import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRestockDraft, writeRestockDraft, clearRestockDrafts, restockDraftKey } from '../restock-draft';

function memoryStorage() {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); } };
}
const line = { productId: 'p', name: '雞肉', imageUrl: null, quantity: 3, variantKey: '50g', weightGrams: 50 };

test('drafts stay with their merchant across reloads and merchant switches', () => {
  const storage = memoryStorage();
  writeRestockDraft(storage, 'a', [line]);
  assert.deepEqual(readRestockDraft(storage, 'b'), []);
  writeRestockDraft(storage, 'b', [{ ...line, quantity: 7 }]);
  assert.equal(readRestockDraft(storage, 'a')[0].quantity, 3);
  assert.equal(readRestockDraft(storage, 'b')[0].quantity, 7);
});

test('logout clears all POS drafts, including unscoped legacy drafts, but keeps unrelated data', () => {
  const storage = memoryStorage();
  storage.setItem('furmosa-pos-restock-cart-v1', JSON.stringify([line]));
  assert.deepEqual(readRestockDraft(storage, 'a'), []);
  assert.equal(storage.getItem('furmosa-pos-restock-cart-v1'), null);
  writeRestockDraft(storage, 'a', [line]);
  writeRestockDraft(storage, 'b', [line]);
  storage.setItem('unrelated', 'keep');
  clearRestockDrafts(storage);
  assert.deepEqual(readRestockDraft(storage, 'a'), []);
  assert.deepEqual(readRestockDraft(storage, 'b'), []);
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('invalid persisted quantities are discarded and denied storage does not break the page', () => {
  const storage = memoryStorage();
  storage.setItem(restockDraftKey('a'), JSON.stringify([line, { ...line, quantity: -1 }, { ...line, quantity: 1.5 }]));
  assert.deepEqual(readRestockDraft(storage, 'a'), [line]);
  const blocked = { ...storage, getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readRestockDraft(blocked, 'a'), []);
  assert.doesNotThrow(() => writeRestockDraft(blocked, 'a', [line]));
});
