import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogSourceError, fetchShopifyCatalog } from '../catalog-source.ts';

const config = { domain: 'furmosa.myshopify.com', token: 'test-token' };

test('fetchShopifyCatalog normalizes GraphQL products and variant ids', async () => {
  const request = async () => new Response(JSON.stringify({
    data: {
      products: {
        nodes: [{
          id: 'gid://shopify/Product/1', title: '雞肉丁', status: 'ACTIVE',
          variants: {
            nodes: [{ id: 'gid://shopify/ProductVariant/2', title: '30g', sku: ' FD-11-30G ', price: '175.00' }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  }), { status: 200 });
  const products = await fetchShopifyCatalog(config, request as typeof fetch);
  assert.deepEqual(products[0], {
    id: 'gid://shopify/Product/1', title: '雞肉丁', status: 'ACTIVE',
    variants: [{ id: 'gid://shopify/ProductVariant/2', title: '30g', sku: 'FD-11-30G', price: 175 }],
  });
});

test('fetchShopifyCatalog refuses incomplete nested variant pagination', async () => {
  const request = async () => new Response(JSON.stringify({
    data: {
      products: {
        nodes: [{
          id: 'gid://shopify/Product/1', title: '超多規格', status: 'ACTIVE',
          variants: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'more' } },
        }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  }), { status: 200 });
  await assert.rejects(
    fetchShopifyCatalog(config, request as typeof fetch),
    (error: unknown) => error instanceof CatalogSourceError && /超過 100/.test(error.message),
  );
});

test('catalog reads public content and structured listing fields without converting shipping weight to net weight', async () => {
  const request = async () => new Response(JSON.stringify({ data: { products: {
    nodes: [{ id: '1', title: '吊飾', status: 'ACTIVE', description: '黏土吊飾', productType: '手作黏土吊飾',
      featuredMedia: { image: { url: 'https://cdn.shopify.com/charm.png' } },
      metafields: { nodes: [{ namespace: 'furmosa', key: 'dimensions', value: '8cm' }] },
      variants: { nodes: [{ id: '2', title: '1件', sku: 'AC-01', price: '399' }], pageInfo: { hasNextPage: false } },
    }], pageInfo: { hasNextPage: false },
  } } }));
  const [product] = await fetchShopifyCatalog(config, request as typeof fetch);
  assert.equal(product!.content!.description, '黏土吊飾');
  assert.equal(product!.content!.imageUrl, 'https://cdn.shopify.com/charm.png');
  assert.deepEqual(product!.content!.fields, { 'furmosa.dimensions': '8cm' });
  assert.equal('weightGrams' in product!.variants[0]!, false);
});

test('fetchShopifyCatalog never treats missing credentials as an empty catalog', async () => {
  await assert.rejects(
    fetchShopifyCatalog({ domain: '', token: '' }),
    (error: unknown) => error instanceof CatalogSourceError && /尚未設定/.test(error.message),
  );
});
