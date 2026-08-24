import assert from 'node:assert/strict';
import test from 'node:test';
import { shopifyWebhookHmac, verifyShopifyWebhook } from '../webhook';

test('accepts a valid Shopify HMAC and rejects invalid signatures', () => {
  const body = JSON.stringify({ id: 123, name: '#1001' });
  const secret = 'test-secret';
  const valid = shopifyWebhookHmac(body, secret);

  assert.equal(verifyShopifyWebhook(body, valid, secret), true);
  assert.equal(verifyShopifyWebhook(`${body}x`, valid, secret), false);
  assert.equal(verifyShopifyWebhook(body, null, secret), false);
});

