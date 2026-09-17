import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMadeToOrderHqProduct,
  shipmentInventoryAdvisories,
} from '../inventory/shipment-advisory';

const tier = { id: 'tier-1', weightGrams: 50, unit: 'g', unitQty: 1 };

function item(input: { sku?: string; quantity?: number; stock?: number; counted?: boolean }) {
  return {
    quantity: input.quantity ?? 1,
    weightGrams: 50,
    variantKey: 'tier-1',
    product: {
      id: input.sku ?? 'product-1',
      sku: input.sku ?? 'FUR-0099',
      name: input.sku === 'FUR-0002' ? '原味雞霸' : '測試零食',
      category: 'treats',
      unit: 'g',
      priceTiers: [tier],
      inventoryBalances: input.stock == null
        ? []
        : [{ quantity: input.stock, unit: 'g', lastCountedAt: input.counted === false ? null : new Date() }],
    },
  };
}

test('原味雞霸是現做品，不產生 HQ 庫存提醒', () => {
  assert.equal(isMadeToOrderHqProduct('fur-0002'), true);
  assert.deepEqual(shipmentInventoryAdvisories([item({ sku: 'FUR-0002' })]), []);
});

test('庫存不足顯示寄出後負數，但不回傳阻擋結果', () => {
  assert.deepEqual(shipmentInventoryAdvisories([item({ quantity: 3, stock: 50 })]), [
    '測試零食庫存 50g，本次需 150g，寄出後為 -100g',
  ]);
});

test('未盤點商品顯示提醒', () => {
  assert.deepEqual(shipmentInventoryAdvisories([item({})]), [
    '測試零食尚未盤點，本次需 50g；仍可寄出',
  ]);
});

test('庫存足夠不顯示提醒', () => {
  assert.deepEqual(shipmentInventoryAdvisories([item({ quantity: 2, stock: 100 })]), []);
});
