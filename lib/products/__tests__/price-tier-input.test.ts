import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTierFields } from '../price-tier-input.ts';

function weightTier(cost?: string) {
  const form = new FormData();
  form.set('mode', 'weight');
  form.set('weightGrams', '15');
  form.set('price', '99');
  if (cost !== undefined) form.set('tierCost', cost);
  return form;
}

describe('product price tier input', () => {
  it('allows an unknown cost to remain empty', () => {
    assert.deepEqual(parseTierFields(weightTier()), {
      weightGrams: 15,
      unit: 'g',
      unitQty: 1,
      price: 99,
      cost: null,
      defaultWholesaleUnitPrice: null,
      sku: null,
      shopifySku: null,
      shopifyVariantId: null,
      notes: null,
    });
  });

  it('normalizes optional tier and Shopify identifiers without converting large ids to numbers', () => {
    const form = weightTier();
    form.set('sku', '  FD-BEEF-30  ');
    form.set('shopifySku', '  SHOP-BEEF-30 ');
    form.set('shopifyVariantId', '900719925474099312345');

    const parsed = parseTierFields(form);
    assert.equal(parsed.sku, 'FD-BEEF-30');
    assert.equal(parsed.shopifySku, 'SHOP-BEEF-30');
    assert.equal(parsed.shopifyVariantId, '900719925474099312345');
  });

  it('rejects a Shopify Variant ID containing non-digits', () => {
    const form = weightTier();
    form.set('shopifyVariantId', 'gid://shopify/ProductVariant/123');
    assert.throws(() => parseTierFields(form), /只能包含數字/);
  });

  it('still rejects zero or negative costs when a cost is supplied', () => {
    assert.throws(() => parseTierFields(weightTier('0')), /成本必須大於 0/);
    assert.throws(() => parseTierFields(weightTier('-1')), /成本必須大於 0/);
  });

  it('stores an integer default wholesale price', () => {
    const form = weightTier('20');
    form.set('defaultWholesaleUnitPrice', '65');
    assert.equal(parseTierFields(form).defaultWholesaleUnitPrice, 65);
    form.set('defaultWholesaleUnitPrice', '65.5');
    assert.throws(() => parseTierFields(form), /整數/);
  });
});
