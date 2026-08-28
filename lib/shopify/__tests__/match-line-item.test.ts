import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MOONCAKE_CATALOG } from '@/lib/products/mooncake-catalog';
import {
  isMooncakeShopifyItem,
  matchShopifyItemToProduct,
  resolvedShopifyItemSku,
  shopifyLineItemHasIdentity,
  type MatchableProduct,
} from '@/lib/shopify/match-line-item';

const mooncake: MatchableProduct = {
  id: 'p-mooncake',
  name: MOONCAKE_CATALOG.name,
  sku: 'FUR-0099',
  sourceSku: 'CK-08',
  unit: '顆',
  priceTiers: [{ weightGrams: 50, price: 79 }],
};

const jiba: MatchableProduct = {
  id: 'p-jiba',
  name: '原味雞霸',
  sku: 'FUR-0001',
  sourceSku: 'CK-05',
  unit: '片',
  priceTiers: [{ weightGrams: null, price: 89 }],
};

describe('shopify line item matching', () => {
  it('accepts a mooncake line without SKU', () => {
    const item = { title: '牠的月餅｜地瓜山藥雞肉月餅 50g', quantity: 1, price: '79' };
    assert.equal(shopifyLineItemHasIdentity(item), true);
    assert.equal(isMooncakeShopifyItem(item), true);
    assert.equal(matchShopifyItemToProduct(item, [mooncake, jiba])?.id, 'p-mooncake');
    assert.equal(resolvedShopifyItemSku(item, mooncake), 'CK-08');
  });

  it('still prefers an explicit Shopify SKU', () => {
    const item = { title: '牠的月餅｜地瓜山藥雞肉月餅 50g', sku: 'CK-08' };
    assert.equal(matchShopifyItemToProduct(item, [mooncake, jiba])?.sourceSku, 'CK-08');
  });

  it('does not invent a match from an empty item', () => {
    assert.equal(shopifyLineItemHasIdentity({}), false);
    assert.equal(matchShopifyItemToProduct({ title: '不存在的宇宙餅乾' }, [mooncake, jiba]), null);
  });
});
