import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inventoryHasActiveFilters,
  inventoryListState,
  inventoryQuantityLabel,
  inventorySubmitBlockedReason,
  inventorySummaryText,
  shouldQuickAddToRestockCart,
  inventoryRestockSubmitItems,
} from '@/lib/pos/inventory-ui';

describe('inventory UI copy', () => {
  it('shows the same quantity the page already has', () => {
    assert.equal(inventoryQuantityLabel(3), '目前庫存：3 件');
    assert.equal(inventoryQuantityLabel(0), '目前庫存：0 件');
  });

  it('summarizes using existing item counts only', () => {
    assert.equal(inventorySummaryText({ totalCount: 12, lowCount: 0 }), '共 12 項商品。');
    assert.equal(
      inventorySummaryText({ totalCount: 12, lowCount: 4 }),
      '共 12 項商品，其中 4 項庫存不足。',
    );
  });
});

describe('inventory filters', () => {
  it('treats category and low-stock as separate active filters', () => {
    assert.equal(
      inventoryHasActiveFilters({ query: '', group: 'all', lowStockOnly: false }),
      false,
    );
    assert.equal(
      inventoryHasActiveFilters({ query: '', group: 'fish', lowStockOnly: false }),
      true,
    );
    assert.equal(
      inventoryHasActiveFilters({ query: '', group: 'all', lowStockOnly: true }),
      true,
    );
    assert.equal(
      inventoryHasActiveFilters({ query: '凍乾', group: 'all', lowStockOnly: false }),
      true,
    );
  });

  it('distinguishes empty store from no search results', () => {
    assert.equal(
      inventoryListState({
        totalCount: 0,
        visibleCount: 0,
        query: '',
        group: 'all',
        lowStockOnly: false,
      }),
      'empty-store',
    );
    assert.equal(
      inventoryListState({
        totalCount: 8,
        visibleCount: 0,
        query: '沒有這個',
        group: 'all',
        lowStockOnly: false,
      }),
      'no-results',
    );
  });
});

describe('inventory restock cart UI guards', () => {
  it('blocks submit when the cart is empty and explains why', () => {
    assert.equal(
      inventorySubmitBlockedReason(0),
      '先從商品加入補貨單，才能送出補貨申請。',
    );
    assert.equal(inventorySubmitBlockedReason(2), null);
  });

  it('does not quick-add again when the product is already in the cart', () => {
    assert.equal(shouldQuickAddToRestockCart(undefined), true);
    assert.equal(shouldQuickAddToRestockCart(0), true);
    assert.equal(shouldQuickAddToRestockCart(6), false);
  });

  it('submits only productId and quantity from the existing cart', () => {
    assert.deepEqual(
      inventoryRestockSubmitItems([
        { productId: 'p1', quantity: 4, extra: 'nope' } as { productId: string; quantity: number },
        { productId: 'p2', quantity: 1 },
      ]),
      [
        { productId: 'p1', quantity: 4 },
        { productId: 'p2', quantity: 1 },
      ],
    );
  });
});
