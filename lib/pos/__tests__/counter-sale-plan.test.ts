import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planCounterSale } from '@/lib/pos/counter-sale-plan';
import {
  filterCounterItems,
  resolveCounterSellStock,
  type CounterCatalogItem,
} from '@/lib/pos/counter-catalog-view';

const priced = [
  {
    productId: 'p1',
    tierId: 't1',
    name: '雞肉丁凍乾',
    sku: 'SKU-001',
    unit: '包',
    weightGrams: 50,
    price: 255,
    priceTiers: [{ price: 255 }],
    suggestedPrice: 255,
    commissionMode: 'percent',
    commissionValue: 20,
    stock: 3,
  },
];

describe('planCounterSale', () => {
  it('fail closed when qty exceeds stock', () => {
    assert.throws(
      () => planCounterSale([{ productId: 'p1', tierId: 't1', qty: 4 }], priced),
      /庫存不足/,
    );
  });

  it('uses merchant suggested price and snapshots commission', () => {
    const planned = planCounterSale([{ productId: 'p1', tierId: 't1', qty: 2 }], priced);
    assert.equal(planned[0]?.unitPrice, 255);
    assert.equal(planned[0]?.commissionAmount, 102);
    assert.equal(planned[0]?.balanceAfter, 1);
    assert.equal(planned[0]?.sku, 'SKU-001');
    assert.equal(planned[0]?.unit, '包');
    assert.equal(planned[0]?.weightGrams, 50);
  });

  it('rejects an empty ticket', () => {
    assert.throws(() => planCounterSale([], priced), /本單是空的/);
  });
});

describe('resolveCounterSellStock', () => {
  it('sells against the legacy empty tier when that is where stock lives', () => {
    const resolved = resolveCounterSellStock({
      listedTierId: 'tier-50g',
      isDefaultTier: true,
      exactStock: undefined,
      legacyStock: 3,
      legacyTierId: '',
    });
    assert.equal(resolved.stock, 3);
    assert.equal(resolved.sellTierId, '');
  });

  it('keeps the listed tier when an exact stock row exists', () => {
    const resolved = resolveCounterSellStock({
      listedTierId: 'tier-50g',
      isDefaultTier: true,
      exactStock: 0,
      legacyStock: 3,
      legacyTierId: '',
    });
    assert.equal(resolved.stock, 0);
    assert.equal(resolved.sellTierId, 'tier-50g');
  });

  it('does not borrow legacy stock for a non-default tier', () => {
    const resolved = resolveCounterSellStock({
      listedTierId: 'tier-100g',
      isDefaultTier: false,
      exactStock: undefined,
      legacyStock: 3,
      legacyTierId: '',
    });
    assert.equal(resolved.stock, 0);
    assert.equal(resolved.sellTierId, 'tier-100g');
  });
});

describe('filterCounterItems', () => {
  const items: CounterCatalogItem[] = [
    {
      key: 'p1::t1',
      productId: 'p1',
      tierId: 't1',
      name: '雞肉丁凍乾',
      specLabel: '50g',
      category: 'freeze_dried',
      categoryLabel: '凍乾',
      unitPrice: 255,
      stock: 3,
      imageUrl: null,
      unit: '包',
    },
    {
      key: 'p2::t1',
      productId: 'p2',
      tierId: 't1',
      name: '原味雞霸',
      specLabel: null,
      category: 'treats',
      categoryLabel: '零食',
      unitPrice: 89,
      stock: 2,
      imageUrl: null,
      unit: '包',
    },
  ];

  it('filters by search and category', () => {
    assert.equal(filterCounterItems(items, '雞霸', 'all').length, 1);
    assert.equal(filterCounterItems(items, '', 'freeze_dried')[0]?.name, '雞肉丁凍乾');
  });
});
