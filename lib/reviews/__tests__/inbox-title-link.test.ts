import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('手機與桌面待審核標題皆連向既有詳情頁，保留審核按鈕', () => {
  const page = readFileSync(new URL('../../../app/(main)/reviews/page.tsx', import.meta.url), 'utf8');
  assert.equal((page.match(/<Link href=\{item.href\} className="[^"]*">\s*\{item.title\}\s*<\/Link>/g) ?? []).length, 2);
  assert.equal((page.match(/<Link href=\{item.href\}>審核<\/Link>/g) ?? []).length, 2);
});
