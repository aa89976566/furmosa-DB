import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/restock-requests/page.tsx', import.meta.url),
  'utf8',
);

test('restock request list uses stable workflow stages', () => {
  assert.match(source, /aria-label="補貨申請階段"/);
  for (const label of ['待處理', '已轉單', '已拒絕']) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, /<table/);
});

test('restock request rows expose the real next action', () => {
  assert.match(source, /status === 'approved'/);
  assert.match(source, /'建立出貨單'/);
  assert.match(source, /status === 'submitted' \|\| status === 'under_review'/);
  assert.match(source, /'審核補貨'/);
  assert.match(source, /restockStatusLabelForHq\(r\.status\)/);
});
