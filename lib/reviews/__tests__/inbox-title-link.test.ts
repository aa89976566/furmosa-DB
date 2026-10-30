import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('待審核工作台只渲染一套 responsive DOM，正式動作連回既有詳情頁', () => {
  const page = readFileSync(new URL('../../../app/(main)/reviews/page.tsx', import.meta.url), 'utf8');
  const workbench = readFileSync(new URL('../../../components/reviews/review-workbench.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../../../components/reviews/review-workbench.module.css', import.meta.url), 'utf8');

  assert.match(page, /<ReviewWorkbench items=\{items\} counts=\{counts\} \/>/);
  assert.equal((workbench.match(/href=\{item\.href\}/g) ?? []).length, 1);
  assert.match(workbench, /\{item\.title\}/);
  assert.match(workbench, /\{item\.actionLabel\}/);
  assert.match(workbench, /onSelect=\{\(\) => setSelectedKey/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /\.detailBody \{[^}]*overflow-y: auto/s);
  assert.match(styles, /\.actionBar \{[^}]*flex: none/s);
});
