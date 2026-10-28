import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listPage = readFileSync(
  new URL('../../../app/(main)/products/shopify-candidates/page.tsx', import.meta.url),
  'utf8',
);
const detailPage = readFileSync(
  new URL('../../../app/(main)/products/shopify-candidates/[id]/page.tsx', import.meta.url),
  'utf8',
);
const actions = readFileSync(
  new URL('../../../app/(main)/products/shopify-candidates/actions.ts', import.meta.url),
  'utf8',
);
const newProductPage = readFileSync(
  new URL('../../../app/(main)/products/new/page.tsx', import.meta.url),
  'utf8',
);
const resolver = readFileSync(
  new URL('../catalog-candidate-resolution.ts', import.meta.url),
  'utf8',
);
const candidateSync = readFileSync(
  new URL('../catalog-sync-service.ts', import.meta.url),
  'utf8',
);

test('candidate list has one safe processing entry per row and status filters', () => {
  assert.match(listPage, /shopify-candidates\/\$\{row\.id\}/);
  assert.match(listPage, /處理狀態篩選/);
  assert.match(listPage, /不需建立/);
  assert.doesNotMatch(listPage, /linkCandidateAction/);
});

test('detail page explains the three outcomes and non-effects', () => {
  assert.match(detailPage, /連結現有商品規格/);
  assert.match(detailPage, /建立新商品/);
  assert.match(detailPage, /不需建立/);
  assert.match(detailPage, /不會變更：售價、成本、重量、單位與庫存/);
  assert.match(detailPage, /需要 HQ 管理員權限/);
});

test('server actions re-check the current database role', () => {
  assert.match(actions, /prisma\.user\.findUnique/);
  assert.match(actions, /actor\?\.role === 'admin'/);
  assert.match(actions, /linkCatalogCandidate/);
  assert.match(actions, /blockCatalogCandidate/);
});

test('new product page treats Shopify price as reference and requires returning to link', () => {
  assert.match(newProductPage, /fromCandidate/);
  assert.match(newProductPage, /僅供參考/);
  assert.match(newProductPage, /系統不會推定重量、單位、成本或庫存/);
  assert.match(newProductPage, /使用「連結現有商品規格」完成第 2 步/);
});

test('resolver serializes variants and uses compare-and-set inside one transaction', () => {
  assert.match(resolver, /pg_advisory_xact_lock/);
  assert.match(resolver, /where: \{ id: candidate\.id, resolution: 'pending' \}/);
  assert.match(resolver, /db\.\$transaction/);
  assert.match(resolver, /previousStatus: 'pending'/);
});

test('Shopify snapshot refresh does not overwrite human resolution fields', () => {
  const snapshotUpdate = candidateSync.match(/upsert\(\{[\s\S]*?update: \{([\s\S]*?)\n\s*\},\n\s*\}\);/)?.[1] ?? '';
  assert.match(snapshotUpdate, /productTitle/);
  assert.match(snapshotUpdate, /lastSeenAt/);
  assert.doesNotMatch(snapshotUpdate, /resolution|linkedProductId|linkedTierId|resolvedById/);
});
