import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { searchStoreCandidates } from '../store-search';

describe('searchStoreCandidates', () => {
  it('台灣門市關鍵字應回真實候選（非選單文案）', () => {
    const hits = searchStoreCandidates('板橋新埔');
    assert.ok(hits.length >= 1);
    assert.ok(hits.some((h) => h.storeName.includes('板橋')));
    assert.ok(hits.every((h) => h.storeName !== '介紹'));
  });

  it('選單捷徑「介紹」不可變成門市候選按鈕', () => {
    assert.deepEqual(searchStoreCandidates('介紹'), []);
    assert.deepEqual(searchStoreCandidates('立即開戶'), []);
    assert.deepEqual(searchStoreCandidates('幫毛孩開戶'), []);
    assert.deepEqual(searchStoreCandidates('Q&A'), []);
  });

  it('過短關鍵字不回候選', () => {
    assert.deepEqual(searchStoreCandidates('北'), []);
  });
});
