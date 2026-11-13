import assert from 'node:assert/strict';
import test from 'node:test';
import { productPushFingerprint, singleTierForPush, pushSingleProduct, PUSH_READ, PUSH_WRITE, type PushProduct } from '../product-push.ts';

const product: PushProduct = { id: 'salmon', status: 'active', productCategory: 'STANDARD', priceTiers: [{
  id: 'tier50', status: 'active', sku: 'FUR-0129', shopifySku: 'FUR-SALMON-SKIN-50', shopifyVariantId: '64882303271289',
  weightGrams: 50, price: 250, cost: 100,
  unit: 'g', unitQty: 1, inventoryPolicy: 'shared',
}] };
const config = { domain: 'example.myshopify.com', token: 'test-token' };
function variant(price = '285.00', cost = '100.00', value = 50) { return {
  id: 'gid://shopify/ProductVariant/64882303271289', sku: 'FUR-SALMON-SKIN-50', price,
  product: { id: 'gid://shopify/Product/15869815161209' },
  inventoryItem: { unitCost: { amount: cost, currencyCode: 'TWD' }, measurement: { weight: { value, unit: 'GRAMS' } } },
}; }
function api(responses: unknown[]) {
  const calls: { query: string; variables: any }[] = [];
  const request = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    const next = responses.shift();
    assert.ok(next, 'unexpected request');
    return Response.json(next);
  }) as typeof fetch;
  return { calls, request };
}
const read = (v = variant(), currencyCode = 'TWD') => ({ data: { shop: { currencyCode }, productVariant: v } });
const written = { data: { productVariantsBulkUpdate: { productVariants: [{ id: variant().id }], userErrors: [] } } };

test('pushes exact bound variant price250 cost100 weight50 and verifies readback', async () => {
  const mock = api([read(), written, read(variant('250.00'))]);
  const result = await pushSingleProduct(product, config, mock.request);
  assert.equal(result.changed, true);
  assert.deepEqual(mock.calls.map(c => c.query), [PUSH_READ, PUSH_WRITE, PUSH_READ]);
  assert.deepEqual(mock.calls[1].variables, { productId: variant().product.id, variants: [{
    id: variant().id, price: '250.00', inventoryItem: { cost: '100.00', measurement: { weight: { value: 50, unit: 'GRAMS' } } },
  }] });
  assert.doesNotMatch(PUSH_WRITE, /inventoryQuantities|inventoryPolicy|descriptionHtml|productCreate|publish/);
});
test('retry after success is a no-op; same weight in kilograms is equivalent', async () => {
  const v = variant('250'); v.inventoryItem.measurement.weight = { value: 0.05, unit: 'KILOGRAMS' };
  const mock = api([read(v)]);
  assert.equal((await pushSingleProduct(product, config, mock.request)).changed, false);
  assert.equal(mock.calls.length, 1);
});
test('mismatched SKU or currency blocks before mutation', async () => {
  for (const response of [read({ ...variant(), sku: 'OTHER' }), read(variant(), 'USD'), { data: { shop: { currencyCode: 'TWD' }, productVariant: null } }]) {
    const mock = api([response]);
    await assert.rejects(pushSingleProduct(product, config, mock.request));
    assert.equal(mock.calls.length, 1);
  }
});
test('invalid amounts, missing binding, special products and multiple active tiers block', () => {
  for (const patch of [{ cost: null }, { cost: -1 }, { price: 0 }, { price: 250.001 }, { price: NaN }, { weightGrams: 0 }, { shopifyVariantId: null },
    { unit: '件' }, { unitQty: 5 }, { inventoryPolicy: 'variant' }]) {
    assert.throws(() => singleTierForPush({ ...product, priceTiers: [{ ...product.priceTiers[0], ...patch }] }));
  }
  assert.throws(() => singleTierForPush({ ...product, productCategory: 'SERVICE' }));
  assert.throws(() => singleTierForPush({ ...product, priceTiers: [...product.priceTiers, ...product.priceTiers] }));
});
test('malformed JSON envelope and HTTP denial never cause a mutation', async () => {
  for (const payload of [null, {}, { data: null }, { errors: [{ message: 'denied' }] }]) {
    let calls = 0;
    const request = (async () => { calls++; return Response.json(payload); }) as typeof fetch;
    await assert.rejects(pushSingleProduct(product, config, request), /Shopify 回傳錯誤/);
    assert.equal(calls, 1);
  }
  await assert.rejects(pushSingleProduct(product, config, (async () => new Response('', { status: 403 })) as typeof fetch), /HTTP 403/);
});
test('user errors and mismatched readback never report success', async () => {
  await assert.rejects(pushSingleProduct(product, config, api([read(), { data: { productVariantsBulkUpdate: { userErrors: [{ message: 'denied' }] } } }]).request));
  await assert.rejects(pushSingleProduct(product, config, api([read(), written, read()]).request), /讀回結果/);
});
test('ambiguous network result surfaces a verification request without retrying mutation', async () => {
  let calls = 0;
  const request = (async () => { calls++; if (calls === 1) return Response.json(read()); throw new Error('secret request payload'); }) as typeof fetch;
  await assert.rejects(pushSingleProduct(product, config, request), /請勿連續重試/);
  assert.equal(calls, 2);
});
test('fingerprint ignores unrelated fields but changes when saved commercial values change', () => {
  const base = productPushFingerprint(product);
  assert.equal(base, productPushFingerprint({ ...product, priceTiers: [{ ...product.priceTiers[0], bundleComponents: [] }] } as PushProduct));
  assert.notEqual(base, productPushFingerprint({ ...product, priceTiers: [{ ...product.priceTiers[0], price: 285 }] }));
});
