import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalTierSku, normalizeCanonicalSku } from '../canonical-sku';

describe('canonical sellable SKU', () => {
  it('keeps one-tier products on the stable family SKU', () => {
    assert.equal(canonicalTierSku('CK-05', { weightGrams: 50, unit: '片', unitQty: 1 }, 1), 'CK-05');
  });

  it('adds weight for multi-tier gram products', () => {
    assert.equal(canonicalTierSku('DK-01', { weightGrams: 30, unit: '克', unitQty: 1 }, 3), 'DK-01-30G');
    assert.equal(canonicalTierSku('FD-11', { weightGrams: 100, unit: '克', unitQty: 1 }, 3), 'FD-11-100G');
  });

  it('adds quantity for multi-tier piece products', () => {
    assert.equal(canonicalTierSku('DK-03', { weightGrams: null, unit: '隻', unitQty: 3 }, 4), 'DK-03-3PC');
  });

  it('normalizes case and whitespace but never guesses a missing family code', () => {
    assert.equal(normalizeCanonicalSku(' ck-05 '), 'CK-05');
    assert.equal(canonicalTierSku(null, { weightGrams: 30 }, 3), null);
  });
});
