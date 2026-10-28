import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/products/shopify-candidates/page.tsx', import.meta.url),
  'utf8',
);
const detailSource = readFileSync(
  new URL('../../../app/(main)/products/shopify-candidates/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('candidate review page can identify previously staged records without SKU', () => {
  assert.match(source, /已有 SKU/);
  assert.match(source, /缺少 SKU/);
  assert.match(source, /sku: \{ not: null \}/);
  assert.match(source, /sku: null/);
});

test('candidate review page clearly prevents unsafe inventory assumptions', () => {
  assert.match(source, /不會自動建立庫存、成本或上架商品/);
  assert.match(source, /shopify-candidates\/\$\{row\.id\}/);
  assert.match(detailSource, /連結現有商品規格/);
  assert.match(detailSource, /建立新商品/);
  assert.match(detailSource, /不需建立/);
  assert.match(detailSource, /不會變更：售價、成本、重量、單位與庫存/);
});
