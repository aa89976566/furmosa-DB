import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerSearchWhere, productSearchWhere } from '../site-search';

describe('order-form search where helpers', () => {
  it('customerSearchWhere builds OR for name/phone', () => {
    const where = customerSearchWhere('淡水');
    assert.ok(where?.OR);
    assert.ok((where!.OR as unknown[]).length >= 2);
  });

  it('productSearchWhere builds OR for sku/name', () => {
    const where = productSearchWhere('FD-01');
    assert.ok(where?.OR);
  });

  it('empty terms return undefined', () => {
    assert.equal(customerSearchWhere('   '), undefined);
    assert.equal(productSearchWhere(''), undefined);
  });
});
