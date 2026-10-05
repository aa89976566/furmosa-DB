import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/jar-exchange/manage/page.tsx', import.meta.url),
  'utf8',
);

test('serial management exposes the selected status filter', () => {
  assert.match(source, /aria-current=\{validStatus === 'available' \? 'page' : undefined\}/);
  assert.match(source, /const selected = validStatus === group\.status/);
  assert.match(source, /aria-current=\{selected \? 'page' : undefined\}/);
  assert.match(source, /border-primary bg-primary\/5/);
});

test('serial management table remains accessible and has a clear section title', () => {
  assert.match(source, /<h2 className="text-sm font-semibold">序號清單<\/h2>/);
  assert.match(source, /<caption className="sr-only">序號管理清單<\/caption>/);
  assert.equal((source.match(/scope="col"/g) ?? []).length, 6);
});
