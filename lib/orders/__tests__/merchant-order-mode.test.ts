import assert from 'node:assert/strict';
import test from 'node:test';
import {
  merchantOrderModesForTypes,
  merchantOrderProductCategory,
  merchantOrderSource,
} from '@/lib/orders/merchant-order-mode';

test('店家只顯示主檔已登記的合作方式', () => {
  assert.deepEqual(
    merchantOrderModesForTypes(['consignment', 'jar_exchange', 'partner']),
    ['consignment', 'jar_exchange'],
  );
});

test('販售使用獨立訂單來源，寄賣與換罐沿用寄賣來源', () => {
  assert.equal(merchantOrderSource('wholesale'), 'wholesale');
  assert.equal(merchantOrderSource('consignment'), 'consignment');
  assert.equal(merchantOrderSource('jar_exchange'), 'consignment');
});

test('換罐與一般店家商品使用不同產品類型', () => {
  assert.equal(merchantOrderProductCategory('jar_exchange'), 'JAR_EXCHANGE');
  assert.equal(merchantOrderProductCategory('consignment'), 'STANDARD');
  assert.equal(merchantOrderProductCategory('wholesale'), 'STANDARD');
});
