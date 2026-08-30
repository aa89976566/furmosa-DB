import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerSearchWhere, expandProductSearchTerms, productSearchWhere } from '../site-search';

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

  it('expands legacy catnip jerky alias to the thin-slice display name', () => {
    assert.deepEqual(expandProductSearchTerms('貓草雞肉乾'), ['貓草雞肉乾', '貓草雞肉薄片']);
    const where = productSearchWhere('貓草雞肉乾30g');
    const raw = JSON.stringify(where);
    assert.match(raw, /貓草雞肉乾30g/);
    assert.match(raw, /貓草雞肉薄片/);
    assert.doesNotMatch(raw, /蝶豆花雞肉薄片/);
  });

  it('expands 月餅 search to the catalog name', () => {
    assert.deepEqual(expandProductSearchTerms('月餅'), ['月餅', '地瓜山藥雞肉月餅']);
    assert.deepEqual(expandProductSearchTerms('牠的月餅'), ['牠的月餅', '地瓜山藥雞肉月餅']);
    assert.deepEqual(expandProductSearchTerms('地瓜山藥雞肉月餅'), ['地瓜山藥雞肉月餅']);
  });
});
