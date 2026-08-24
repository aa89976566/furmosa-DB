import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  validateShopifyOrderPayload,
  validatePaidOrderPayload,
  shopifyShippingFeeType,
  hasCompleteShopifyPickupInfo,
  shopifyPickupInfo,
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

  it('accepts an unpaid order at creation time', () => {
    assert.doesNotThrow(() =>
      validateShopifyOrderPayload({ ...paidOrder, financial_status: 'pending' }),
    );
  });

  it('keeps Shopify checkout shipping inside the order total', () => {
    assert.equal(shopifyShippingFeeType(60), 'unpaid');
    assert.equal(shopifyShippingFeeType(0), 'free');
  });

  it('reads confirmed convenience-store details from Shopify order attributes', () => {
    const order: ShopifyPaidOrder = {
      ...paidOrder,
      note_attributes: [
        { name: '超商品牌', value: '7-ELEVEN' },
        { name: '取貨縣市', value: '台北市' },
        { name: '取貨區域', value: '信義區' },
        { name: '取貨門市名稱', value: '市府門市' },
        { name: '取貨門市店號', value: '123456' },
      ],
    };
    assert.deepEqual(shopifyPickupInfo(order), {
      brand: '711',
      city: '台北市',
      district: '信義區',
      storeName: '市府門市',
      storeId: '123456',
    });
    assert.equal(hasCompleteShopifyPickupInfo(order), true);
  });

  it('keeps pickup details pending when required location fields are missing', () => {
    const order: ShopifyPaidOrder = {
      ...paidOrder,
      note_attributes: [
        { name: '超商品牌', value: '全家' },
        { name: '取貨門市名稱', value: '市府門市' },
      ],
    };
    assert.equal(shopifyPickupInfo(order).brand, 'familymart');
    assert.equal(hasCompleteShopifyPickupInfo(order), false);
  });
});
