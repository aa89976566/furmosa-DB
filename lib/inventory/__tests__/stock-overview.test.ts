import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryStockState, inventoryPackEstimates, compareInventoryUrgency, type InventoryRow } from '../workbench';
const base: InventoryRow = { id: 'p', name: '雞肉丁', sku: 'FD01', hqSku: 'FD01', productCode: 'P1', vendorId: null, vendorName: '', category: 'freeze_dried', quantity: 1000, unit: 'g', version: null, canCount: true, otherWarehouses: [], reorderPoint: 100 };
test('stock states distinguish negative, missing setup, zero and actual product reorder threshold', () => {
  assert.equal(inventoryStockState(base), 'in_stock');
  assert.equal(inventoryStockState({ ...base, quantity: 100 }), 'low');
  assert.equal(inventoryStockState({ ...base, quantity: 0 }), 'zero');
  assert.equal(inventoryStockState({ ...base, quantity: -30 }), 'negative');
  assert.equal(inventoryStockState({ ...base, quantity: null, canCount: false }), 'needs_setup');
  assert.equal(inventoryStockState({ ...base, canCount: false }), 'needs_setup');
  assert.equal(inventoryStockState({ ...base, status: 'inactive' }), 'inactive');
  assert.equal(inventoryStockState({ ...base, productCategory: 'SERVICE' }), 'special');
  assert.equal(inventoryStockState({ ...base, quantity: 1, reorderPoint: undefined }), 'in_stock');
});
test('pack estimates share the same bulk pool, round down and ignore invalid or incompatible tiers', () => {
  const row = { ...base, priceTiers: [
    { weightGrams: 30, unit: '克', unitQty: 1 }, { weightGrams: 50, unit: 'g', unitQty: 1 },
    { weightGrams: 30, unit: 'g', unitQty: 1 }, { weightGrams: 0, unit: 'g', unitQty: 1 },
    { weightGrams: 5, unit: '片', unitQty: 1 }, { weightGrams: 10, unit: 'g', unitQty: 2 },
  ] };
  assert.deepEqual(inventoryPackEstimates(row), [{ weight: 30, packs: 33 }, { weight: 50, packs: 20 }]);
  assert.deepEqual(inventoryPackEstimates({ ...row, unit: '包' }), []);
  assert.deepEqual(inventoryPackEstimates({ ...row, quantity: -1 }), []);
  assert.deepEqual(inventoryPackEstimates({ ...row, canCount: false }), []);
  assert.deepEqual(inventoryPackEstimates({ ...row, quantity: 0 }), []);
});
test('urgency compares states rather than mixing grams and pieces', () => {
  const rows = [base, { ...base, id: 'zero', quantity: 0, unit: '片' }, { ...base, id: 'negative', quantity: -1 }, { ...base, id: 'low', quantity: 90 }];
  assert.deepEqual(rows.sort(compareInventoryUrgency).map(row => row.id), ['negative','zero','low','p']);
});
