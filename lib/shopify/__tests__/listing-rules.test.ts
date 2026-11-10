import assert from 'node:assert/strict';
import test from 'node:test';
import { checkListingRules } from '../listing-rules.ts';
import type { ShopifyCatalogProduct } from '../catalog-sync.ts';

const charm: ShopifyCatalogProduct = {
  id: '1', title: '雞霸', status: 'ACTIVE',
  variants: [{ id: '2', title: '1件', sku: 'AC-01', price: 399 }],
  content: { description: '黏土吊飾', imageUrl: 'https://cdn.shopify.com/charm.png', productType: '手作黏土吊飾', fields: {
    'furmosa.material_details': '黏土', 'furmosa.dimensions': '8cm', 'furmosa.package_contents': '1件',
    'furmosa.play_guide': '掛在包包', 'furmosa.cleaning_care': '乾布輕拭',
  } },
};
test('accessory requires its own fields without feeding requirements and does not mutate input', () => {
  const before = JSON.stringify(charm);
  assert.equal(checkListingRules(charm, [charm]).status, 'fields_complete');
  assert.equal(JSON.stringify(charm), before);
});
test('marketing name never determines the product kind', () => {
  const row = { ...charm, content: { ...charm.content!, productType: '' } };
  assert.ok(checkListingRules(row, [row]).issues.some(issue => issue.code === 'TYPE_REQUIRED'));
});
test('food requires storage and feeding while accessory fields cannot satisfy it', () => {
  const row = { ...charm, content: { ...charm.content!, productType: '食品' } };
  const result = checkListingRules(row, [row]);
  assert.ok(result.issues.some(issue => issue.field === 'furmosa.storage_and_feeding'));
});
test('duplicate SKU and missing SKU are actionable at variant level', () => {
  const other = { ...charm, id: '3', variants: [{ ...charm.variants[0]!, id: '4', sku: ' ac-01 ' }] };
  assert.ok(checkListingRules(charm, [charm, other]).issues.some(issue => issue.code === 'SKU_DUPLICATE'));
  const blank = { ...charm, variants: [{ ...charm.variants[0]!, sku: null }] };
  assert.ok(checkListingRules(blank, [blank]).issues.some(issue => issue.code === 'SKU_REQUIRED'));
});
test('a bundle must have an explicit operational contract before automatic creation', () => {
  const row = { ...charm, content: { ...charm.content!, productType: '組合' } };
  assert.ok(checkListingRules(row, [row]).issues.some(issue => issue.code === 'SPECIAL_FLOW_REQUIRED'));
});
