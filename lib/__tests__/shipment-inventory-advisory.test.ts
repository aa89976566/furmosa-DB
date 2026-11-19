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

test('換罐與一般商品共用來源單品，庫存提醒累加克數', () => {
  const standard = item({ stock: 80 });
  const jar = { ...item({ stock: -300 }), quantity: 1, product: { ...item({}).product,
    id: 'jar', productCategory: 'JAR_EXCHANGE', unit: '條',
    inventorySourceProduct: { ...standard.product, status: 'active' },
  } };
  assert.deepEqual(shipmentInventoryAdvisories([standard, jar]), ['測試零食庫存 80g，本次需 100g，寄出後為 -20g']);
  assert.match(shipmentInventoryAdvisories([{ ...jar, product: { ...jar.product, inventorySourceProduct: null } }])[0], /尚未設定有效庫存來源/);
});

test('現做換罐按兩種原料的庫存各自提醒', () => {
  const throat = { ...item({ sku: 'FUR-0008', stock: 20 }).product, name: '鴨喉', status: 'active' };
  const lung = { ...item({ sku: 'FUR-0005', stock: 100 }).product, name: '鴨肺', status: 'active' };
  const jar = {
    quantity: 2, weightGrams: null, variantKey: 'jar-tier',
    product: {
      ...item({ sku: 'RF-CRISPY-DUCK' }).product,
      name: '脆脆鴨', unit: '罐', productCategory: 'JAR_EXCHANGE',
      priceTiers: [{ id: 'jar-tier', weightGrams: null, unit: '罐', unitQty: 1, bundleComponents: [
        { componentProduct: throat, gramsPerPack: 12 }, { componentProduct: lung, gramsPerPack: 15 },
      ] }],
    },
  };
  assert.deepEqual(shipmentInventoryAdvisories([jar]), ['鴨喉庫存 20g，本次需 24g，寄出後為 -4g']);
  assert.match(shipmentInventoryAdvisories([{ ...jar, weightGrams: 28 }])[0], /配方與規格不一致/);
});
