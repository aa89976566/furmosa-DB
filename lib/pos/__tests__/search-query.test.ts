import assert from 'node:assert/strict';
import { it } from 'node:test';
import { posSearchQuery } from '@/lib/pos/search-query';

it('keeps repeated q parameters safe for both POS search pages', () => {
  assert.equal(posSearchQuery([' 雞肉 ', '牛肉']), '雞肉');
  assert.equal(posSearchQuery(' 牛肉 '), '牛肉');
  assert.equal(posSearchQuery(undefined), '');
  assert.equal(posSearchQuery([]), '');
  assert.equal(posSearchQuery(['', '牛肉']), '');
});
