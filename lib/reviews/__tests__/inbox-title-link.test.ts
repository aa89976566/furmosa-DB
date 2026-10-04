import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('待處理資源列表只渲染一套 responsive DOM，標題與下一步都連到既有詳情頁', () => {
  const page = readFileSync(new URL('../../../app/(main)/reviews/page.tsx', import.meta.url), 'utf8');
  const list = readFileSync(new URL('../../../components/reviews/review-resource-list.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../../../components/reviews/review-resource-list.module.css', import.meta.url), 'utf8');

  assert.match(page, /<ReviewResourceList items=\{items\} \/>/);
  assert.equal((list.match(/href=\{item\.href\}/g) ?? []).length, 2);
  assert.match(list, /\{item\.title\}/);
  assert.match(list, /\{item\.actionLabel\}/);
  assert.match(styles, /container-type: inline-size/);
  assert.match(styles, /@container \(min-width: 760px\)/);
});
