import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterInventoryItems,
  inventoryGroupForProduct,
  inventoryStockStatus,
  isLowOrSoldOutStock,
} from '@/lib/pos/inventory-groups';

describe('inventoryStockStatus', () => {
  it('uses 已售完 / 庫存偏低 / 庫存正常', () => {
    assert.equal(inventoryStockStatus(0).label, '已售完');
    assert.equal(inventoryStockStatus(2).label, '庫存偏低');
    assert.equal(inventoryStockStatus(3).label, '庫存偏低');
    assert.equal(inventoryStockStatus(5).label, '庫存正常');
  });
});

describe('inventoryGroupForProduct', () => {
  it('puts freeze-dried before flavour', () => {
    assert.equal(inventoryGroupForProduct({ name: '柳葉魚凍乾', category: 'freeze_dried' }), 'freeze_dried');
    assert.equal(inventoryGroupForProduct({ name: '雞肉丁凍乾' }), 'freeze_dried');
    assert.equal(inventoryGroupForProduct({ name: '原味雞霸' }), 'chicken');
    assert.equal(inventoryGroupForProduct({ name: '水晶魚' }), 'fish');
    assert.equal(inventoryGroupForProduct({ name: '烘烤雞胸' }), 'baked');
    assert.equal(inventoryGroupForProduct({ name: '鴨肉蘋果' }), 'other');
  });
});

describe('filterInventoryItems', () => {
  const items = [
    { name: '柳葉魚凍乾', sku: 'FD-01', sourceSku: 'FD-01', group: 'freeze_dried' as const, quantity: 0 },
    { name: '水晶魚', sku: 'FD-02', sourceSku: null, group: 'fish' as const, quantity: 2 },
    { name: '鴨肉蘋果', sku: 'TR-09', sourceSku: null, group: 'other' as const, quantity: 5 },
  ];

  it('filters by group, low stock, and sku search', () => {
    assert.equal(filterInventoryItems(items, { query: '', group: 'all', lowStockOnly: false }).length, 3);
    assert.equal(filterInventoryItems(items, { query: '', group: 'freeze_dried', lowStockOnly: false }).length, 1);
    assert.equal(filterInventoryItems(items, { query: '', group: 'all', lowStockOnly: true }).length, 2);
    assert.equal(filterInventoryItems(items, { query: 'FD-01', group: 'all', lowStockOnly: false })[0]?.name, '柳葉魚凍乾');
    assert.equal(isLowOrSoldOutStock(5), false);
  });
});
