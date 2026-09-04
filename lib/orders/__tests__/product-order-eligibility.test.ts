import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProductOrderEligibility } from '../product-order-eligibility';

test('客戶訂單仍顯示缺貨商品，但不可選取並說明原因', () => {
  assert.deepEqual(
    evaluateProductOrderEligibility({
      scope: 'customer_in_stock',
      availableStock: 0,
    }),
    {
      canSelect: false,
      code: 'OUT_OF_STOCK',
      message: '目前無庫存，請先補貨',
    },
  );
});

test('店家進貨缺少價格時不可選取並說明原因', () => {
  assert.deepEqual(
    evaluateProductOrderEligibility({
      scope: 'merchant_standard',
      availableStock: 5,
      hasWholesalePrice: false,
    }),
    {
      canSelect: false,
      code: 'MISSING_WHOLESALE_PRICE',
      message: '尚未設定此店家的進貨價',
    },
  );
});

test('符合條件的商品可以選取', () => {
  assert.deepEqual(
    evaluateProductOrderEligibility({
      scope: 'customer_in_stock',
      availableStock: 3,
    }),
    { canSelect: true, code: 'AVAILABLE', message: null },
  );
});
