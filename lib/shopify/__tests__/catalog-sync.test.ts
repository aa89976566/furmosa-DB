import assert from 'node:assert/strict';
import test from 'node:test';
import { planShopifyHqCatalogSync, type HqCatalogProduct, type ShopifyCatalogProduct } from '../catalog-sync.ts';

function hq(overrides: Partial<HqCatalogProduct> = {}): HqCatalogProduct {
  return {
    id: 'hq-product-1', productId: 'PROD-1', name: '舊名稱', status: 'active', price: 100, sourceSku: 'FD-11',
    priceTiers: [
      { id: 'tier-30', status: 'active', sku: null, shopifySku: null, shopifyVariantId: null, weightGrams: 30, unit: '克', unitQty: 1, price: 100 },
      { id: 'tier-50', status: 'active', sku: 'FD-11-50G', shopifySku: null, shopifyVariantId: null, weightGrams: 50, unit: '克', unitQty: 1, price: 200 },
      { id: 'tier-old', status: 'active', sku: 'FD-11-10G', shopifySku: null, shopifyVariantId: null, weightGrams: 10, unit: '克', unitQty: 1, price: 60 },
    ],
    ...overrides,
  };
}

function shop(overrides: Partial<ShopifyCatalogProduct> = {}): ShopifyCatalogProduct {
  return {
    id: 'gid://shopify/Product/1', title: '雞肉丁凍乾', status: 'ACTIVE',
    variants: [
      { id: 'gid://shopify/ProductVariant/30', title: '30g', sku: 'FD-11-30G', price: 175 },
      { id: 'gid://shopify/ProductVariant/50', title: '50g', sku: 'FD-11-50G', price: 300 },
    ],
    ...overrides,
  };
}

test('exact unique SKUs bind identities, prices and archive only obsolete tiers', () => {
  const plan = planShopifyHqCatalogSync([shop()], [hq()]);
  assert.equal(plan.conflicts.length, 0);
  assert.deepEqual(plan.tierUpdates.map((row) => [row.tierId, row.sku, row.shopifyVariantId, row.price]), [
    ['tier-30', 'FD-11-30G', '30', 175],
    ['tier-50', 'FD-11-50G', '50', 300],
  ]);
  assert.deepEqual(plan.tierArchives.map((row) => row.tierId), ['tier-old']);
  assert.deepEqual(plan.productUpdates[0], {
    productId: 'hq-product-1', shopifyProductId: 'gid://shopify/Product/1', name: '雞肉丁凍乾', price: 175, status: 'active',
  });
});

test('draft Shopify product maps to HQ draft without deleting history', () => {
  const plan = planShopifyHqCatalogSync([shop({ status: 'DRAFT' })], [hq()]);
  assert.equal(plan.productUpdates[0]?.status, 'draft');
});

test('duplicate Shopify SKU blocks automatic binding', () => {
  const duplicate = shop({
    variants: [
      { id: 'gid://shopify/ProductVariant/30', title: '30g', sku: 'FD-11-30G', price: 175 },
      { id: 'gid://shopify/ProductVariant/31', title: 'duplicate', sku: 'FD-11-30G', price: 175 },
    ],
  });
  const plan = planShopifyHqCatalogSync([duplicate], [hq({ priceTiers: [hq().priceTiers[0]!] })]);
  assert.equal(plan.tierUpdates.length, 0);
  assert.equal(plan.conflicts.some((row) => row.code === 'DUPLICATE_SHOPIFY_SKU'), true);
});

test('two HQ products claiming one Shopify product are blocked, not guessed', () => {
  const claim = { ...hq().priceTiers[0]!, sku: 'FD-11-30G' };
  const first = hq({ priceTiers: [claim] });
  const second = hq({ id: 'hq-product-2', productId: 'PROD-2', priceTiers: [{ ...claim, id: 'tier-30-copy' }] });
  const plan = planShopifyHqCatalogSync([shop({ variants: [shop().variants[0]!] })], [first, second]);
  assert.equal(plan.tierUpdates.length, 0);
  assert.equal(plan.productUpdates.length, 0);
  assert.equal(plan.conflicts.some((row) => row.code === 'DUPLICATE_HQ_PRODUCT_CLAIM'), true);
});

test('blank Shopify SKUs are reported and never matched by title or price', () => {
  const plan = planShopifyHqCatalogSync([shop({ variants: [{ id: 'v-blank', title: '30g', sku: null, price: 100 }] })], [hq()]);
  assert.equal(plan.ignoredBlankShopifySkus, 1);
  assert.deepEqual(plan.blankShopifyVariants, [{
    productId: 'gid://shopify/Product/1', productTitle: '雞肉丁凍乾', productStatus: 'ACTIVE',
    variantId: 'v-blank', variantTitle: '30g', price: 100,
  }]);
  assert.equal(plan.tierUpdates.length, 0);
  assert.equal(plan.tierArchives.length, 0);
});


test('unmatched HQ tiers are classified without guessing or modifying them', () => {
  const product = hq({
    priceTiers: [
      { ...hq().priceTiers[0]!, sku: null },
      { ...hq().priceTiers[1]!, sku: 'UNKNOWN-SKU' },
    ],
  });
  const plan = planShopifyHqCatalogSync([], [product]);
  assert.deepEqual(plan.unmatchedHqTiers.map((row) => [row.tierId, row.reason]), [
    ['tier-30', 'no_shopify_match'],
    ['tier-50', 'no_shopify_match'],
  ]);
  assert.equal(plan.tierUpdates.length, 0);
  assert.equal(plan.productUpdates.length, 0);
  assert.equal(plan.tierArchives.length, 0);
});

test('HQ tier without any stable identity is marked missing_identity', () => {
  const product = hq({ sourceSku: null, priceTiers: [{ ...hq().priceTiers[0]!, sku: null, shopifySku: null }] });
  const plan = planShopifyHqCatalogSync([], [product]);
  assert.equal(plan.unmatchedHqTiers[0]?.reason, 'missing_identity');
});

test('archived HQ tiers cannot claim or conflict with an active Shopify variant', () => {
  const active = {
    ...hq().priceTiers[0]!,
    id: 'tier-active-30',
    status: 'active',
    sku: 'FD-11-30G',
  };
  const archived = {
    ...active,
    id: 'tier-archived-10',
    status: 'archived',
    sku: null,
    shopifySku: 'FD-11-30G',
    shopifyVariantId: '30',
    weightGrams: 10,
  };
  const plan = planShopifyHqCatalogSync(
    [shop({ variants: [shop().variants[0]!] })],
    [hq({ priceTiers: [archived, active] })],
  );

  assert.equal(plan.conflicts.some((row) => row.code === 'DUPLICATE_HQ_VARIANT_CLAIM'), false);
  assert.deepEqual(plan.tierUpdates.map((row) => row.tierId), ['tier-active-30']);
  assert.equal(plan.unmatchedHqTiers.some((row) => row.tierId === 'tier-archived-10'), false);
});

test('an already synchronized catalog produces no repeated writes', () => {
  const product = hq({
    name: '雞肉丁凍乾',
    price: 175,
    priceTiers: [
      { ...hq().priceTiers[0]!, sku: 'FD-11-30G', shopifySku: 'FD-11-30G', shopifyVariantId: '30', price: 175 },
      { ...hq().priceTiers[1]!, shopifySku: 'FD-11-50G', shopifyVariantId: '50', price: 300 },
    ],
  });
  const plan = planShopifyHqCatalogSync([shop()], [product]);
  assert.equal(plan.tierUpdates.length, 0);
  assert.equal(plan.productUpdates.length, 0);
  assert.equal(plan.tierArchives.length, 0);
});
