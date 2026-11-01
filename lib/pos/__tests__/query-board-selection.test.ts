import assert from 'node:assert/strict';
import test from 'node:test';
import { selectVisibleRestockProgress } from '../query-board-selection.ts';

const restock = {
  id: 'restock-1',
  kind: 'restock' as const,
  restockProgress: { stage: 'not_shipped' as const },
};

test('empty or non-restock filters clear the previously selected restock detail', () => {
  assert.equal(selectVisibleRestockProgress([], restock.id), null);
  assert.equal(selectVisibleRestockProgress([{ ...restock, kind: 'refill', restockProgress: undefined }], restock.id), null);
});

test('visible restock selection is kept or falls back within the visible list', () => {
  const second = { ...restock, id: 'restock-2' };
  assert.equal(selectVisibleRestockProgress([restock, second], second.id)?.id, second.id);
  assert.equal(selectVisibleRestockProgress([restock, second], 'missing')?.id, restock.id);
});
