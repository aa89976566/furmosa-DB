import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/customers/page.tsx', import.meta.url),
  'utf8',
);

test('customer list uses a stable segmented category navigation', () => {
  assert.match(source, /title="客戶"/);
  assert.match(source, /aria-label="客戶分類"/);
  assert.match(source, /bg-black text-white shadow-sm/);
  assert.doesNotMatch(source, /title="客戶 Customers"/);
});

test('customer table groups identity and commercial context into six columns', () => {
  for (const label of ['客戶', '身份', '聯絡', '消費', '最近活動']) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, />編號<\/TableHead>/);
  assert.doesNotMatch(source, />類型<\/TableHead>/);
  assert.doesNotMatch(source, />電話<\/TableHead>/);
  assert.doesNotMatch(source, />訂單<\/TableHead>/);
  assert.match(source, /\{c\._count\.orders\} 筆訂單/);
  assert.match(source, /LINE \{c\.lineDisplay \?\? c\.lineUserId\}/);
  assert.match(source, /colSpan=\{6\}/);
});
