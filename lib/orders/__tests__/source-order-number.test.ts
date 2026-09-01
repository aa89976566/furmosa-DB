import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nextSourceOrderNumber,
  SOURCE_ORDER_PREFIX,
} from '@/lib/orders/source-order-number';

describe('source order numbering', () => {
  it('starts Shopify and LINE independently at 01', () => {
    assert.equal(nextSourceOrderNumber(SOURCE_ORDER_PREFIX.shopify), 'SHOPIFY-01');
    assert.equal(nextSourceOrderNumber(SOURCE_ORDER_PREFIX.line), 'LINE-01');
  });

  it('increments without resetting and grows beyond two digits', () => {
    assert.equal(nextSourceOrderNumber(SOURCE_ORDER_PREFIX.shopify, 'SHOPIFY-09'), 'SHOPIFY-10');
    assert.equal(nextSourceOrderNumber(SOURCE_ORDER_PREFIX.line, 'LINE-99'), 'LINE-100');
  });

  it('does not let a different legacy prefix affect the new sequence', () => {
    assert.equal(nextSourceOrderNumber(SOURCE_ORDER_PREFIX.shopify, 'SHOP-1021-591225'), 'SHOPIFY-01');
  });
});
