import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOrderLineTierId } from '../order-line-tier';

test('單一規格商品會自動選取唯一規格', () => {
  assert.equal(resolveOrderLineTierId([{ id: 'tier-50g' }], ''), 'tier-50g');
});

test('多規格商品未選規格時會自動選取第一個有效規格', () => {
  assert.equal(
    resolveOrderLineTierId([{ id: 'tier-30g' }, { id: 'tier-50g' }], ''),
    'tier-30g',
  );
});

test('多規格商品保留使用者已選取的有效規格', () => {
  assert.equal(
    resolveOrderLineTierId([{ id: 'tier-30g' }, { id: 'tier-50g' }], 'tier-50g'),
    'tier-50g',
  );
});

test('舊規格不存在時改用目前第一個有效規格', () => {
  assert.equal(
    resolveOrderLineTierId([{ id: 'tier-30g' }, { id: 'tier-50g' }], 'deleted-tier'),
    'tier-30g',
  );
});

test('沒有規格的商品維持空 tierId', () => {
  assert.equal(resolveOrderLineTierId([], 'legacy-tier'), '');
});
