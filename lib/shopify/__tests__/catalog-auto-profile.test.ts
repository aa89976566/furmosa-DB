import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogAutoCreateProfile, HQ_CATALOG_PROFILE_KEY } from '../catalog-auto-profile.ts';
import { normalizeCandidateCreateInput } from '../catalog-candidate-create.ts';
import type { ShopifyCatalogProduct } from '../catalog-sync.ts';

const profile = { version: 1, autoCreate: true, category: 'accessories', variants: { '2': { mode: 'unit', unit: '件', unitQty: 1, cost: 300 } } };
function product(value: unknown = profile): ShopifyCatalogProduct {
  return { id: '1', title: '雞霸吊飾', status: 'ACTIVE', variants: [{ id: 'gid://shopify/ProductVariant/2', title: '1件', sku: 'AC-01', price: 399 }],
    content: { description: '黏土吊飾', imageUrl: 'https://cdn.shopify.com/charm.png', productType: '手作黏土吊飾', fields: {
      'furmosa.material_details': '黏土', 'furmosa.dimensions': '8cm', 'furmosa.package_contents': '1件', 'furmosa.play_guide': '掛包包', 'furmosa.cleaning_care': '乾布清潔',
      [HQ_CATALOG_PROFILE_KEY]: JSON.stringify(value),
    } } };
}
test('explicit one-piece accessory profile is eligible without converting shipping grams into inventory units', () => {
  const row = product();
  const result = catalogAutoCreateProfile(row, [row]);
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.profile.variants['2'], { mode: 'unit', unit: '件', unitQty: 1, cost: 300 });
});
for (const [name, value] of Object.entries({ zeroCost: { ...profile, variants: { '2': { mode: 'unit', unit: '件', unitQty: 1, cost: 0 } } },
  missingOptIn: { ...profile, autoCreate: false }, wrongVersion: { ...profile, version: 2 },
  missingSpec: { ...profile, variants: {} }, oldVariant: { ...profile, variants: { '3': profile.variants['2'] } },
  inventedUnit: { ...profile, variants: { '2': { ...profile.variants['2'], unit: '未知單位' } } },
  extraOverride: { ...profile, inventory: 5 } })) {
  test(`profile rejects ${name}`, () => { const row = product(value); assert.equal(catalogAutoCreateProfile(row, [row]).ok, false); });
}
test('incomplete listing and draft sources cannot auto-create', () => {
  const row = product();
  row.content!.fields['furmosa.material_details'] = '';
  assert.equal(catalogAutoCreateProfile(row, [row]).ok, false);
  const draft = { ...product(), status: 'DRAFT' as const };
  assert.equal(catalogAutoCreateProfile(draft, [draft]).ok, false);
});
test('manual and automatic creation share the supported 件 unit', () => {
  const input = { candidateId: 'c', expectedFingerprint: 'f', shopDomain: 'store.myshopify.com', actorId: 'a',
    source: { productId: '1', variantId: '2', productTitle: '吊飾', variantTitle: '1件', sku: 'AC-01', price: 399, shopifyStatus: 'ACTIVE' },
    category: 'accessories', mode: 'unit' as const, unit: '件', unitQty: 1, cost: 300 };
  assert.equal(normalizeCandidateCreateInput(input).unit, '件');
});
