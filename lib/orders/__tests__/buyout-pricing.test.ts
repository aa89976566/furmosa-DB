import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteDefaultBuyoutTier } from '../buyout-pricing.ts';

test('雞霸買斷未達 30 件時拒絕', () => {
  assert.throws(
    () => quoteDefaultBuyoutTier({ sku: 'FUR-0002', retailUnitPrice: 165, quantity: 29 }),
    /最低 30 件/,
  );
});

test('雞霸買斷 30 至 49 件為 25% 折扣', () => {
  const quote = quoteDefaultBuyoutTier({ sku: 'FUR-0002', retailUnitPrice: 165, quantity: 30 });
  assert.deepEqual(quote, {
    ruleId: 'chicken-buyout-v2',
    discountBps: 2500,
    minimumQuantity: 30,
    retailUnitPrice: 165,
    wholesaleUnitPrice: 123.75,
  });
});

test('雞霸買斷 50 件以上為 30% 折扣', () => {
  const quote = quoteDefaultBuyoutTier({ sku: 'FUR-0002', retailUnitPrice: 165, quantity: 50 });
  assert.equal(quote?.discountBps, 3000);
  assert.equal(quote?.wholesaleUnitPrice, 115.5);
});

test('其他 SKU 不繼承雞霸買斷級距', () => {
  assert.equal(
    quoteDefaultBuyoutTier({ sku: 'FUR-0001', retailUnitPrice: 180, quantity: 50 }),
    null,
  );
});
