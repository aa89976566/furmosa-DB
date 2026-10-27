import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveKnownShopifySourceName,
  resolveShopifyProductSources,
  type ProductSourceCatalogItem,
} from '../shopify-product-source.ts';

function catalog(overrides: Partial<ProductSourceCatalogItem> = {}): ProductSourceCatalogItem {
  return {
    id: 'product-1',
    sku: 'HQ-BROTH',
    sourceSku: 'SEL-XMQ-LTM-BROTH',
    vendor: { id: 'vendor-1', vendorId: 'VEN-001', name: '怪獸部落' },
    priceTiers: [{
      sku: 'SEL-XMQ-LTM-BROTH',
      shopifySku: 'SEL-XMQ-LTM-BROTH',
      shopifyVariantId: '123456',
      status: 'active',
    }],
    ...overrides,
  };
}

test('shows the HQ vendor for an exactly bound Shopify variant', () => {
  const result = resolveShopifyProductSources([
    { title: '匠寵嚴選｜怪獸部落 無膠鮮肉煲', sku: 'OTHER', variantId: '123456' },
  ], [catalog()]);

  assert.deepEqual(result, [{
    productId: 'product-1',
    vendorId: 'vendor-1',
    vendorCode: 'VEN-001',
    vendorName: '怪獸部落',
  }]);
});

test('falls back to an exact SKU when Shopify recreated the variant', () => {
  const result = resolveShopifyProductSources([
    { title: '匠寵嚴選｜怪獸部落 無膠鮮肉煲', sku: 'SEL-XMQ-LTM-BROTH', variantId: '999999' },
  ], [catalog()]);

  assert.equal(result[0]?.vendorName, '怪獸部落');
});

test('does not guess a source when the product is unbound or has no vendor', () => {
  const lines = [{ title: '未知商品', sku: 'UNKNOWN', variantId: '' }];
  assert.deepEqual(resolveShopifyProductSources(lines, [catalog()]), [null]);
  assert.deepEqual(resolveShopifyProductSources([
    { title: '商品', sku: 'SEL-XMQ-LTM-BROTH', variantId: '123456' },
  ], [catalog({ vendor: null })]), [null]);
});


test('shows a curated source for a legacy unmapped Shopify SKU', () => {
  assert.equal(resolveKnownShopifySourceName({
    title: '匠寵嚴選｜怪獸部落 無膠鮮肉煲',
    sku: 'SEL-XMQ-LTM-BROTH',
    variantId: '',
  }), '怪獸部落');
  assert.equal(resolveKnownShopifySourceName({
    title: '未知商品',
    sku: 'UNKNOWN',
    variantId: '',
  }), null);
});
