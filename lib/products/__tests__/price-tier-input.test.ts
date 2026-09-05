import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTierFields } from '@/lib/products/price-tier-input';

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
      notes: null,
    });
  });

  it('still rejects zero or negative costs when a cost is supplied', () => {
    assert.throws(() => parseTierFields(weightTier('0')), /成本必須大於 0/);
    assert.throws(() => parseTierFields(weightTier('-1')), /成本必須大於 0/);
  });
});
