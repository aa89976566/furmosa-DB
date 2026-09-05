import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGACY_MERCHANT_STOCK_TIER_ID } from '@/lib/merchant-stock-key';
import { buildMerchantProductTierStocks } from '@/lib/merchant-product-tier-stocks';

const tiers = [
  { id: 't30', weightGrams: 30, unit: 'g', unitQty: 30, price: 100, notes: null },
  { id: 't50', weightGrams: 50, unit: 'g', unitQty: 50, price: 150, notes: null },
  { id: 't100', weightGrams: 100, unit: 'g', unitQty: 100, price: 200, notes: null },
];

test('multi-weight: exposes every configured tier before any stock exists', () => {
  const result = buildMerchantProductTierStocks('p1', tiers, []);

  assert.equal(result.totalQuantity, 0);
  assert.deepEqual(
    result.tierStocks.map((t) => [t.tierId, t.quantity]),
    [
      ['t30', 0],
      ['t50', 0],
      ['t100', 0],
    ],
  );
});

test('multi-weight: shows every configured tier and fills missing stock with zero', () => {
  const result = buildMerchantProductTierStocks('p1', tiers, [
    { productId: 'p1', tierId: 't30', quantity: 3 },
    { productId: 'p1', tierId: 't50', quantity: 2 },
  ]);
  assert.equal(result.totalQuantity, 5);
  assert.equal(result.tierStocks.length, 3);
  assert.deepEqual(
    result.tierStocks.map((t) => [t.tierId, t.quantity]),
    [
      ['t30', 3],
      ['t50', 2],
      ['t100', 0],
    ],
  );
});

test('multi-weight: keeps legacy stock and also exposes configured tiers', () => {
  const result = buildMerchantProductTierStocks('p1', tiers, [
    { productId: 'p1', tierId: LEGACY_MERCHANT_STOCK_TIER_ID, quantity: 5 },
  ]);
  assert.equal(result.totalQuantity, 5);
  assert.equal(result.tierStocks.length, 4);
  assert.deepEqual(
    result.tierStocks.map((t) => [t.label, t.quantity]),
    [
      ['30g', 0],
      ['50g', 0],
      ['100g', 0],
      ['未分規格', 5],
    ],
  );
});

test('single-weight: aggregates all rows', () => {
  const single = [{ id: 't1', weightGrams: null, unit: '包', unitQty: 1, price: 89, notes: null }];
  const result = buildMerchantProductTierStocks('p2', single, [
    { productId: 'p2', tierId: LEGACY_MERCHANT_STOCK_TIER_ID, quantity: 8 },
  ]);
  assert.equal(result.totalQuantity, 8);
  assert.equal(result.tierStocks[0].quantity, 8);
});
