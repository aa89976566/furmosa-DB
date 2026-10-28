import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(
  new URL('../../../app/(main)/products/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('product form remounts when the product or commercial terms version changes', () => {
  const productForms = pageSource.match(/<ProductForm\b[\s\S]*?\/>/g) ?? [];

  assert.equal(productForms.length, 1, '商品詳情頁應只有一個 ProductForm');
  assert.match(
    productForms[0],
    /key=\{`\$\{product\.id\}:\$\{product\.commercialTermsVersion \?\? 0\}`\}/,
  );
});
