import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newOrderNeedsReview, newOrderNotifyCopy } from '@/lib/notifications/new-order-copy';

describe('new order notification copy', () => {
  it('marks Shopify orders as needing review', () => {
    assert.equal(newOrderNeedsReview('shopify'), true);
    assert.equal(newOrderNeedsReview('manual'), false);
    assert.equal(newOrderNeedsReview('manual', true), true);
  });

  it('tells HQ staff a Shopify order is waiting for review', () => {
    const copy = newOrderNotifyCopy({
      id: 'ord-1',
      orderNumber: 'SHOP-1001-123456',
      total: 79,
      source: 'shopify',
    });
    assert.equal(copy.title, '待審核訂單 SHOP-1001-123456');
    assert.match(copy.body, /Shopify/);
    assert.match(copy.body, /請確認後出貨/);
    assert.equal(copy.url, '/orders/ord-1');
  });
});
