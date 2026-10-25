import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(
  new URL('../../../app/(main)/products/shopify-audit/page.tsx', import.meta.url),
  'utf8',
);
const productsSource = readFileSync(
  new URL('../../../app/(main)/products/page.tsx', import.meta.url),
  'utf8',
);

test('product management exposes the Shopify audit entry point', () => {
  assert.match(productsSource, /href="\/products\/shopify-audit"/);
  assert.match(productsSource, /檢查 Shopify 商品/);
});

test('Shopify audit page is explicitly read-only and reports review categories', () => {
  assert.match(pageSource, /只檢查 Shopify 正在上架的商品/);
  assert.match(pageSource, /blankShopifyVariants/);
  assert.match(pageSource, /unmatchedShopifyVariants/);
  assert.match(pageSource, /unmatchedHqTiers/);
  assert.match(pageSource, /現有商品問題/);
  assert.match(pageSource, /待建立或補資料/);
  assert.match(pageSource, /Shopify 有 SKU，HQ 尚未建立/);
  assert.match(pageSource, /正式套用仍需完整確認/);
  assert.match(pageSource, /product\.status === 'ACTIVE'/);
  assert.match(pageSource, /Shopify 上架商品/);
  assert.match(pageSource, /<details/);
  assert.match(pageSource, /slice\(0, 50\)/);
  assert.match(pageSource, /hqTierLabels/);
  assert.match(pageSource, /shopifyVariantLabels/);
  assert.match(pageSource, /未設定 SKU/);
  assert.match(pageSource, /已封存/);
  assert.match(pageSource, /使用中/);
  assert.doesNotMatch(pageSource, /mode:\s*['"]apply['"]/);
  assert.doesNotMatch(pageSource, /prisma\.\$transaction/);
});
