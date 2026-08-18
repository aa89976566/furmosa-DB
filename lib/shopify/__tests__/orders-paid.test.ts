import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  validatePaidOrderPayload,
  verifyShopifyWebhookHmac,
  type ShopifyPaidOrder,
} from '@/lib/shopify/orders-paid';

const paidOrder: ShopifyPaidOrder = {
  id: 123,
  financial_status: 'paid',
  line_items: [{ sku: 'SKU-1', quantity: 1, price: '100' }],
};

describe('Shopify orders/paid webhook', () => {
  it('accepts a valid HMAC and rejects a changed body', () => {
    const secret = 'test-secret';
    const body = JSON.stringify(paidOrder);
    const signature = createHmac('sha256', secret).update(body).digest('base64');
    assert.equal(verifyShopifyWebhookHmac(body, signature, secret), true);
    assert.equal(verifyShopifyWebhookHmac(`${body} `, signature, secret), false);
  });

  it('requires paid status, SKU and positive quantities', () => {
    assert.doesNotThrow(() => validatePaidOrderPayload(paidOrder));
    assert.throws(
      () => validatePaidOrderPayload({ ...paidOrder, financial_status: 'pending' }),
      /尚未付款/,
    );
    assert.throws(
      () => validatePaidOrderPayload({ ...paidOrder, line_items: [{ quantity: 1 }] }),
      /缺少 SKU/,
    );
  });
});
