import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/products/shopify-candidates/page.tsx', import.meta.url),
  'utf8',
);

test('candidate review page separates records with and without SKU', () => {
  assert.match(source, /已有 SKU/);
  assert.match(source, /缺少 SKU/);
  assert.match(source, /sku: \{ not: null \}/);
  assert.match(source, /sku: null/);
});

test('candidate review page clearly prevents unsafe inventory assumptions', () => {
  assert.match(source, /不會自動建立庫存、成本或上架商品/);
  assert.match(source, /先到 Shopify 補上唯一 SKU/);
  assert.match(source, /確認是否販售、單位、成本與初始庫存/);
});
