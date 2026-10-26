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
const actionSource = readFileSync(
  new URL('../../../app/(main)/products/shopify-audit/actions.ts', import.meta.url),
  'utf8',
);

test('product management exposes the Shopify audit entry point', () => {
  assert.match(productsSource, /href="\/products\/shopify-audit"/);
  assert.match(productsSource, /檢查 Shopify 商品/);
});

test('Shopify audit page separates safe sync from review categories', () => {
  assert.match(pageSource, /未對應商品留在待處理區/);
  assert.match(pageSource, /blankShopifyVariants/);
  assert.match(pageSource, /unmatchedShopifyVariants/);
  assert.match(pageSource, /unmatchedHqTiers/);
  assert.match(pageSource, /現有商品問題/);
  assert.match(pageSource, /待建立或補資料/);
  assert.match(pageSource, /ShopifyStageCandidatesForm/);
  assert.match(pageSource, /不建立庫存、不猜成本/);
  assert.match(pageSource, /Shopify 有 SKU，HQ 尚未建立/);
  assert.match(pageSource, /正式套用仍需完整確認/);
  assert.match(pageSource, /Shopify 上架商品/);
  assert.match(pageSource, /<details/);
  assert.match(pageSource, /slice\(0, 50\)/);
  assert.match(pageSource, /hqTierLabels/);
  assert.match(pageSource, /shopifyVariantLabels/);
  assert.match(pageSource, /未設定 SKU/);
  assert.match(pageSource, /已封存/);
  assert.match(pageSource, /使用中/);
  assert.doesNotMatch(pageSource, /prisma\.\$transaction/);
});

test('catalog writes require a fresh admin role, fingerprint and one transaction', () => {
  assert.match(actionSource, /role\?\.role !== 'admin'/);
  assert.match(actionSource, /audit\.fingerprint !== expectedFingerprint/);
  assert.match(actionSource, /prisma\.\$transaction/);
  assert.match(actionSource, /未確認的商品沒有被新增或覆蓋/);
  assert.match(actionSource, /stageUnmatchedCatalog/);
  assert.match(actionSource, /timeout: 120_000/);
  assert.match(actionSource, /尚未建立庫存或猜測成本/);
});
