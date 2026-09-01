import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { processShopifyWebhook } from '@/lib/shopify/webhook-process';
import { verifyShopifyWebhookHmac } from '@/lib/shopify/webhook-verify';
import { FakeShopifyStore } from './fake-webhook-store';

const SECRET = 'webhook-test-secret';
const SHOP = 'furmosa-test.myshopify.com';

const orderBody = {
  id: 1001,
  name: '#1001',
  financial_status: 'pending',
  updated_at: '2026-09-01T00:00:00Z',
  line_items: [{ sku: 'CK-30', title: '鴨喉嚨 30g', quantity: 1, price: '84', grams: 30 }],
  email: 'customer@example.com',
  phone: '0912345678',
  shipping_address: { address1: '台北市信義區假資料路1號', phone: '0912345678' },
};

function sign(body: string) {
  return createHmac('sha256', SECRET).update(body, 'utf8').digest('base64');
}

function storeWithProduct() {
  const store = new FakeShopifyStore();
  store.seedProduct({
    id: 'prod-30',
    name: '鴨喉嚨',
    sku: 'FUR-0030',
    sourceSku: 'CK-30',
    unit: '包',
    priceTiers: [{ weightGrams: 30, price: 84 }],
  });
  return store;
}

function requestFor(topic: string, raw: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/shopify/webhooks/test', {
    method: 'POST',
    headers: {
      'x-shopify-hmac-sha256': sign(raw),
      'x-shopify-topic': topic,
      'x-shopify-shop-domain': SHOP,
      'x-shopify-webhook-id': 'wh-verify-1',
      ...headers,
    },
    body: raw,
  });
}

describe('Shopify webhook ingress verification', () => {
  it('accepts a valid HMAC and rejects a changed body in constant-time compare', () => {
    const body = JSON.stringify(orderBody);
    const hmac = sign(body);
    assert.equal(verifyShopifyWebhookHmac(body, hmac, SECRET), true);
    assert.equal(verifyShopifyWebhookHmac(`${body} `, hmac, SECRET), false);
    assert.equal(verifyShopifyWebhookHmac(body, hmac, ''), false);
    assert.equal(verifyShopifyWebhookHmac(body, '', SECRET), false);
  });

  it('returns 401 for HMAC failure before JSON parsing', async () => {
    const store = new FakeShopifyStore();
    const raw = '{not-json';
    const req = new Request('http://localhost/api/shopify/webhooks/orders-create', {
      method: 'POST',
      headers: {
        'x-shopify-hmac-sha256': 'aaaa',
        'x-shopify-topic': 'orders/create',
        'x-shopify-shop-domain': SHOP,
      },
      body: raw,
    });
    const result = await processShopifyWebhook(req, 'orders/create', { db: store, secret: SECRET });
    assert.equal(result.status, 401);
    assert.equal(store.createAttempts, 0);
  });

  it('requires the exact expected topic', async () => {
    const store = new FakeShopifyStore();
    const raw = JSON.stringify(orderBody);
    const missing = await processShopifyWebhook(
      requestFor('orders/create', raw, { 'x-shopify-topic': '' }),
      'orders/create',
      { db: store, secret: SECRET },
    );
    assert.equal(missing.status, 400);
    const mismatch = await processShopifyWebhook(requestFor('orders/paid', raw), 'orders/create', {
      db: store,
      secret: SECRET,
    });
    assert.equal(mismatch.status, 400);
  });

  it('requires a shop domain and rejects configured mismatches', async () => {
    const store = new FakeShopifyStore();
    const raw = JSON.stringify(orderBody);
    const missing = await processShopifyWebhook(
      requestFor('orders/create', raw, { 'x-shopify-shop-domain': ' ' }),
      'orders/create',
      { db: store, secret: SECRET },
    );
    assert.equal(missing.status, 403);
    const mismatch = await processShopifyWebhook(requestFor('orders/create', raw), 'orders/create', {
      db: store,
      secret: SECRET,
      expectedShopDomain: 'other-shop.myshopify.com',
    });
    assert.equal(mismatch.status, 403);
    const allowed = await processShopifyWebhook(requestFor('orders/create', raw), 'orders/create', {
      db: storeWithProduct(),
      secret: SECRET,
      expectedShopDomain: ' Furmosa-Test.myshopify.com ',
    });
    assert.equal(allowed.status, 200);
  });

  it('safely rejects malformed JSON after a valid HMAC', async () => {
    const store = new FakeShopifyStore();
    const raw = '{not-json';
    const result = await processShopifyWebhook(requestFor('orders/create', raw), 'orders/create', {
      db: store,
      secret: SECRET,
    });
    assert.equal(result.status, 400);
    assert.equal(store.createAttempts, 0);
  });
});
