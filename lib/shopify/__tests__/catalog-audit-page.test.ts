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
  assert.match(pageSource, /只讀比較 Shopify 與 HQ/);
  assert.match(pageSource, /blankShopifyVariants/);
  assert.match(pageSource, /unmatchedShopifyVariants/);
  assert.match(pageSource, /unmatchedHqTiers/);
  assert.match(pageSource, /系統會禁止正式套用/);
  assert.doesNotMatch(pageSource, /mode:\s*['"]apply['"]/);
  assert.doesNotMatch(pageSource, /prisma\.\$transaction/);
});
