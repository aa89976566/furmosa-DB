import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeLegacyProductName,
  parseShopifyVariantWeight,
  resolveLegacyCatalogReference,
} from '../legacy-catalog-reference';

const NOW = new Date('2026-10-29T12:00:00.000Z');

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    snapshotDate: '2026-10-20',
    masterItems: [{ name: '柳葉魚凍乾', sourceSku: 'FD-07', category: 'freeze_dried' }],
    priceRows: [{
      sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', unit: 'g',
      retail: [{ label: '50g', grams: 50, price: 180 }, { label: '100g', grams: 100, price: 320 }],
    }],
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-03-17', unit: 'g', costPerUnit: 2.5 }],
    ...overrides,
  };
}

function resolve(snapshot: unknown, variantTitle = '100g', productTitle = '柳葉魚凍乾', shopifyPrice = 400) {
  return resolveLegacyCatalogReference({ productTitle, variantTitle, shopifyPrice, now: NOW, snapshot });
}

test('normalizes names and prefers exact product-name matches', () => {
  assert.equal(normalizeLegacyProductName('  柳葉魚\u3000凍乾 '), '柳葉魚 凍乾');
  assert.equal(normalizeLegacyProductName('柳\u200B葉魚凍乾'), '柳葉魚凍乾');
  assert.equal(resolve(fixture(), '100g', '柳葉魚凍乾').reference?.matchedBy, 'exact_product_name');
  assert.equal(resolve(fixture(), '柳葉魚凍乾 100g', '不存在的商品').reference, null);
});

test('matches a complete canonical product name at the end of a Shopify marketing title', () => {
  for (const title of ['◈ 走敢若飛 ◈ 鴨翅', '走敢若飛鴨翅', '◈\u200B走敢若飛◈鴨翅']) {
    const result = resolve(fixture({
      masterItems: [{ name: '鴨翅', sourceSku: 'DK-02', category: 'treats' }],
      priceRows: [{ sourceSku: 'DK-02', name: '鴨翅', vendor: '寵物村', unit: '隻', retail: [] }],
      purchaseRows: [],
    }), '單支', title);
    assert.equal(result.reference?.canonicalName, '鴨翅', title);
    assert.equal(result.reference?.matchedBy, 'product_title_suffix', title);
  }
});

test('uses the longest safe canonical suffix', () => {
  const result = resolve(fixture({
    masterItems: [
      { name: '鴨翅', sourceSku: 'DK-01', category: 'treats' },
      { name: '辣鴨翅', sourceSku: 'DK-02', category: 'treats' },
    ],
    priceRows: [{ sourceSku: 'DK-02', name: '辣鴨翅', vendor: '寵物村', unit: '隻', retail: [] }],
    purchaseRows: [],
  }), '單支', '好吃辣鴨翅');
  assert.equal(result.reference?.canonicalName, '辣鴨翅');
  assert.equal(result.reference?.sourceSku, 'DK-02');
});

test('does not use unsafe or fuzzy title matches', () => {
  const shortName = fixture({
    masterItems: [{ name: '魚', sourceSku: 'F-01', category: 'freeze_dried' }],
    priceRows: [], purchaseRows: [],
  });
  assert.equal(resolve(shortName, '100g', '好吃魚').reference, null);
  assert.equal(resolve(shortName, '100g', '魚').reference?.matchedBy, 'exact_product_name');

  for (const title of ['柳葉魚凍乾（5入）', '柳葉魚凍乾 200g', '柳葉魚凍乾禮盒', '柳葉魚', '特選柳葉魚乾']) {
    assert.equal(resolve(fixture(), '100g', title).reference, null, title);
  }
});

test('does not fall back from a conflicted exact name to a shorter suffix', () => {
  const result = resolve(fixture({
    masterItems: [
      { name: '辣鴨翅', sourceSku: 'DK-01', category: 'treats' },
      { name: '辣鴨翅', sourceSku: 'DK-02', category: 'treats' },
      { name: '鴨翅', sourceSku: 'DK-03', category: 'treats' },
    ],
    priceRows: [], purchaseRows: [],
  }), '單支', '辣鴨翅');
  assert.equal(result.reference, null);
  assert.deepEqual(result.reasons, ['NAME_CONFLICT', 'NO_WEIGHT']);
});

test('stops when the longest canonical suffix maps to multiple legacy source SKUs', () => {
  const result = resolve(fixture({
    masterItems: [
      { name: '鴨翅', sourceSku: 'DK-01', category: 'treats' },
      { name: '鴨翅', sourceSku: 'DK-02', category: 'treats' },
    ],
    priceRows: [], purchaseRows: [],
  }), '單支', '◈ 走敢若飛 ◈ 鴨翅');
  assert.equal(result.reference, null);
  assert.deepEqual(result.reasons, ['NAME_CONFLICT', 'NO_WEIGHT']);
});

test('legacy source SKU remains display-only in the reference result', () => {
  const result = resolve(fixture(), '100g', '◈ 海味仔 ◈ 柳葉魚凍乾');
  assert.equal(result.reference?.sourceSku, 'FD-07');
  assert.equal(result.reference?.matchedBy, 'product_title_suffix');
  assert.deepEqual(result.prefill, { category: 'freeze_dried', cost: 250 });
});

test('parses only one unambiguous integer gram specification from Shopify', () => {
  assert.equal(parseShopifyVariantWeight('100 g'), 100);
  assert.equal(parseShopifyVariantWeight('100公克'), 100);
  assert.equal(parseShopifyVariantWeight('100克'), 100);
  assert.equal(parseShopifyVariantWeight('Extra 100g'), 100);
  for (const value of ['100.5g', '1,000g', '1kg', '100g×2', '100g*2', '100g＊2', '100g x2', '100 g X2', '100gx2', '100g+50g', '50g / 100g', '一百克', '預設規格']) {
    assert.equal(parseShopifyVariantWeight(value), null, value);
  }
});

test('uses Shopify weight and latest valid per-gram cost for prefill', () => {
  const result = resolve(fixture({
    purchaseRows: [
      { sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-03-17', unit: 'g', costPerUnit: 2.5 },
      { sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-01-01', unit: 'g', costPerUnit: 2 },
    ],
  }));
  assert.equal(result.weightGrams, 100);
  assert.deepEqual(result.prefill, { category: 'freeze_dried', cost: 250 });
  assert.equal(result.reference?.sourceSku, 'FD-07');
  assert.equal(result.reference?.costDate, '2026-03-17');
  assert.equal(result.reference?.legacyRetailPrice, 320);
});

test('leaves cost blank for missing, invalid, and non-positive cost data', () => {
  const missingDate = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', unit: 'g', costPerUnit: 2.5 }],
  }));
  assert.equal(missingDate.available, false);
  assert.ok(missingDate.reasons.includes('SNAPSHOT_INVALID'));

  const invalidValue = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-03-17', unit: 'g', costPerUnit: Number.NaN }],
  }));
  assert.ok(invalidValue.reasons.includes('SNAPSHOT_INVALID'));

  const nonPositive = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-03-17', unit: 'g', costPerUnit: 0 }],
  }));
  assert.equal(nonPositive.prefill.cost, null);
  assert.ok(nonPositive.reasons.includes('NO_COST'));
});

test('keeps Shopify weight when there is no legacy name match', () => {
  const result = resolve(fixture(), '50g', '不存在的商品');
  assert.equal(result.weightGrams, 50);
  assert.equal(result.prefill.cost, null);
  assert.deepEqual(result.reasons, ['NO_MATCH']);
});

test('rejects a name that maps to more than one legacy source SKU', () => {
  const snapshot = fixture({
    masterItems: [
      { name: '鴨喉嚨', sourceSku: 'DK-01', category: 'treats' },
      { name: '鴨喉嚨', sourceSku: 'DK-05', category: 'treats' },
    ],
    priceRows: [], purchaseRows: [],
  });
  const result = resolve(snapshot, '50g', '鴨喉嚨');
  assert.equal(result.weightGrams, 50);
  assert.equal(result.reference, null);
  assert.ok(result.reasons.includes('NAME_CONFLICT'));
});

test('rejects source rows whose canonical name conflicts with the master', () => {
  const snapshot = fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '另一商品', vendor: '寵物村', date: '2026-03-17', unit: 'g', costPerUnit: 2.5 }],
  });
  assert.ok(resolve(snapshot).reasons.includes('SOURCE_CONFLICT'));
});

test('hard-stops malformed, future, and stale snapshot data', () => {
  const malformed = resolve({ snapshotDate: 'not-a-date', masterItems: [], priceRows: [], purchaseRows: [] });
  assert.equal(malformed.available, false);
  assert.ok(malformed.reasons.includes('SNAPSHOT_INVALID'));
  assert.ok(resolve(fixture({ snapshotDate: '2026-02-31' })).reasons.includes('SNAPSHOT_INVALID'));

  const future = resolve(fixture({ snapshotDate: '2027-01-01' }));
  assert.equal(future.available, false);
  assert.ok(future.reasons.includes('SNAPSHOT_FUTURE'));

  const stale = resolve(fixture({ snapshotDate: '2024-01-01' }));
  assert.equal(stale.prefill.category, null);
  assert.equal(stale.prefill.cost, null);
  assert.ok(stale.reasons.includes('SNAPSHOT_STALE'));
});

test('leaves cost blank for stale cost, unsupported unit, and cost above price', () => {
  const stale = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2024-01-01', unit: 'g', costPerUnit: 2.5 }],
  }));
  assert.equal(stale.prefill.cost, null);
  assert.ok(stale.reasons.includes('COST_STALE'));

  const unsupported = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-03-17', unit: '隻', costPerUnit: 30 }],
  }));
  assert.ok(unsupported.reasons.includes('COST_UNIT_UNSUPPORTED'));

  const expensive = resolve(fixture(), '100g', '柳葉魚凍乾', 200);
  assert.equal(expensive.prefill.cost, null);
  assert.ok(expensive.reasons.includes('COST_ABOVE_PRICE'));
});

test('rejects cost rows dated after the snapshot or after today', () => {
  const afterSnapshot = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-10-25', unit: 'g', costPerUnit: 2.5 }],
  }));
  assert.equal(afterSnapshot.prefill.cost, null);
  assert.ok(afterSnapshot.reasons.includes('COST_FUTURE'));

  const afterToday = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2027-01-01', unit: 'g', costPerUnit: 2.5 }],
  }));
  assert.equal(afterToday.prefill.cost, null);
  assert.ok(afterToday.reasons.includes('COST_FUTURE'));
});

test('uses a calendar-day 18-month cost boundary', () => {
  const atBoundary = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2025-04-29', unit: 'g', costPerUnit: 2.5 }],
  }));
  assert.equal(atBoundary.prefill.cost, 250);

  const oneDayOld = resolve(fixture({
    purchaseRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2025-04-28', unit: 'g', costPerUnit: 2.5 }],
  }));
  assert.equal(oneDayOld.prefill.cost, null);
  assert.ok(oneDayOld.reasons.includes('COST_STALE'));
});

test('rejects malformed retail specifications instead of using them', () => {
  const badRetail = fixture({
    priceRows: [{ sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', unit: 'g', retail: [{ label: '錯誤', grams: -50, price: -1 }] }],
  });
  const result = resolve(badRetail);
  assert.equal(result.available, false);
  assert.ok(result.reasons.includes('SNAPSHOT_INVALID'));
});

test('leaves cost blank when valid historical costs vary by more than two times', () => {
  const result = resolve(fixture({
    purchaseRows: [
      { sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-03-17', unit: 'g', costPerUnit: 2.5 },
      { sourceSku: 'FD-07', name: '柳葉魚凍乾', vendor: '寵物村', date: '2026-01-01', unit: 'g', costPerUnit: 1 },
    ],
  }));
  assert.equal(result.prefill.cost, null);
  assert.ok(result.reasons.includes('COST_OUTLIER'));
});

test('keeps Shopify weight but blocks cost when legacy package spec disagrees', () => {
  const result = resolve(fixture(), '75g');
  assert.equal(result.weightGrams, 75);
  assert.equal(result.prefill.cost, null);
  assert.ok(result.reasons.includes('SPEC_MISMATCH'));
});
