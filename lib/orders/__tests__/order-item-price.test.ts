import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOrderItemUnitPrice } from '@/lib/order-item-cost';

const product = {
  price: 120,
  priceTiers: [
    { id: 'small', price: 80 },
    { id: 'large', price: 160 },
  ],
};

test('新增訂單依所選規格自動取得單價', () => {
  assert.equal(resolveOrderItemUnitPrice(product, 'small'), 80);
  assert.equal(resolveOrderItemUnitPrice(product, 'large'), 160);
});

test('沒有規格或規格不存在時使用商品主檔售價', () => {
  assert.equal(resolveOrderItemUnitPrice(product), 120);
  assert.equal(resolveOrderItemUnitPrice(product, 'missing'), 120);
});

test('主檔價格不合法時不產生負值', () => {
  assert.equal(resolveOrderItemUnitPrice({ price: -1, priceTiers: [] }), 0);
});
