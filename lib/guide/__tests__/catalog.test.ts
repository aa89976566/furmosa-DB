import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogFingerprint, mapGuideCatalog, loadGuideCatalog } from '../catalog.ts';
import type { CatalogRow, ReviewedRule } from '../catalog.ts';
const row: CatalogRow = {
  id: 'gid://shopify/Product/1', title: '虛構測試商品', status: 'ACTIVE', onlineStoreUrl: 'https://furmosa.com/products/fixture',
  metafields: { nodes: [{ key: 'food_source', value: '測試成分' }], pageInfo: { hasNextPage: false } },
  variants: { nodes: [{ id: 'gid://shopify/ProductVariant/2', title: '30g', sku: 'FIXTURE', availableForSale: true, price: '100.00' }], pageInfo: { hasNextPage: false } },
};
const rule: ReviewedRule = {
  variantId: row.variants.nodes[0].id, sku: 'FIXTURE', fingerprint: catalogFingerprint(row, row.variants.nodes[0].id),
  reviewedAt: '2026-01-01', evidenceUrls: ['https://example.org/fixture'], species: ['dog'], needs: ['training'], category: 'food',
  ingredients: ['beef'], minAgeMonths: null, maxAgeMonths: null, verifiedClaims: [],
};
test('核實綁定精確變體，連結帶變體且不輸出來源紀錄', () => {
  const result = mapGuideCatalog([row], [rule]);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].url, 'https://furmosa.com/products/fixture?variant=2');
  assert.equal('evidenceUrls' in result.products[0], false);
});
test('無核實規則不能從商品名推論適用', () => {
  const result = mapGuideCatalog([row], []);
  assert.deepEqual(result.products, []); assert.equal(result.reviewPending, true);
});
test('商品適用欄位改動使舊核實失效', () => {
  const changed = structuredClone(row); changed.metafields.nodes[0].value = '不同成分';
  assert.equal(mapGuideCatalog([changed], [rule]).issues[0].code, 'REVIEW_STALE');
});
test('庫存價格變動不改核實指紋，缺貨仍不推薦', () => {
  const changed = structuredClone(row); changed.variants.nodes[0].price = '120.00';
  assert.equal(catalogFingerprint(changed, rule.variantId), rule.fingerprint);
  changed.variants.nodes[0].availableForSale = false;
  assert.deepEqual(mapGuideCatalog([changed], [rule]).products, []);
});
test('截斷頁與重複核實不可放行', () => {
  const changed = structuredClone(row); changed.variants.pageInfo.hasNextPage = true;
  assert.equal(mapGuideCatalog([changed], [rule]).issues[0].code, 'INCOMPLETE_PAGE');
  assert.equal(mapGuideCatalog([row], [rule, rule]).issues[0].code, 'AMBIGUOUS_REVIEW');
});
test('供應商內部欄位不影響或流入公開推薦資料', () => {
  const changed = structuredClone(row); changed.metafields.nodes.push({ key: 'procurement_record', value: 'PRIVATE_FIXTURE' });
  assert.equal(catalogFingerprint(changed, rule.variantId), rule.fingerprint);
  assert.equal(JSON.stringify(mapGuideCatalog([changed], [rule])).includes('PRIVATE_FIXTURE'), false);
});
test('API錯誤不偽裝成零商品', async () => {
  const request = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  await assert.rejects(loadGuideCatalog({ domain: 'fixture.myshopify.com', token: 'fixture' }, request), /CATALOG_UNAVAILABLE/);
});
test('分頁重複游標會拒絕不完整目錄', async () => {
  const request = (async () => Response.json({ data: { products: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'same' } } } })) as typeof fetch;
  await assert.rejects(loadGuideCatalog({ domain: 'fixture.myshopify.com', token: 'fixture' }, request), /CATALOG_INCOMPLETE/);
});
