import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MOONCAKE_CATALOG,
  isMooncakeSearchTerm,
  mooncakePriceListRow,
} from '@/lib/products/mooncake-catalog';
import { PRODUCT_UNIT_OPTIONS, TIER_UNIT_PRESETS } from '@/lib/product-units';

describe('mooncake catalog', () => {
  it('matches the live Shopify 50g treat', () => {
    assert.equal(MOONCAKE_CATALOG.name, '地瓜山藥雞肉月餅');
    assert.equal(MOONCAKE_CATALOG.sourceSku, 'CK-08');
    assert.equal(MOONCAKE_CATALOG.weightGrams, 50);
    assert.equal(MOONCAKE_CATALOG.price, 129);
    assert.equal(MOONCAKE_CATALOG.vendor, '匠寵');
    assert.equal(MOONCAKE_CATALOG.unit, '顆');
    assert.match(MOONCAKE_CATALOG.shopifyTitle, /牠的月餅/);
    assert.match(MOONCAKE_CATALOG.notes, /CK-08/);
    assert.equal(
      (PRODUCT_UNIT_OPTIONS as readonly string[]).includes(MOONCAKE_CATALOG.unit),
      true,
    );
    assert.equal((TIER_UNIT_PRESETS as readonly string[]).includes(MOONCAKE_CATALOG.unit), true);
  });

  it('exports a price-list row the importer can upsert', () => {
    const row = mooncakePriceListRow();
    assert.equal(row.sourceSku, 'CK-08');
    assert.deepEqual(row.prices, [{ weightGrams: 50, unitQty: 1, price: 129 }]);
  });

  it('recognizes HQ and Shopify search names', () => {
    assert.equal(isMooncakeSearchTerm('月餅'), true);
    assert.equal(isMooncakeSearchTerm('牠的月餅'), true);
    assert.equal(isMooncakeSearchTerm('地瓜山藥雞肉月餅 50g'), true);
    assert.equal(isMooncakeSearchTerm('雞霸'), false);
  });
});
