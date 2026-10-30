import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  merchantOrderDisplayLabel,
  merchantOrderModesForTypes,
  merchantOrderProductCategory,
  merchantOrderSource,
  orderMerchandiseIsBillable,
} from '../merchant-order-mode.ts';

const orderDetailSource = readFileSync(
  new URL('../../../app/(main)/orders/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('訂單詳情優先顯示已知的店家合作方式', () => {
  assert.equal(merchantOrderDisplayLabel('jar_exchange'), '換罐計畫');
  assert.equal(merchantOrderDisplayLabel('consignment'), '寄賣');
  assert.equal(merchantOrderDisplayLabel('wholesale'), '買斷');
});

test('舊單或未知合作方式保留既有來源顯示', () => {
  assert.equal(merchantOrderDisplayLabel(null), null);
  assert.equal(merchantOrderDisplayLabel(undefined), null);
  assert.equal(merchantOrderDisplayLabel(''), null);
  assert.equal(merchantOrderDisplayLabel('future_mode'), null);
});

test('訂單詳情以合作方式顯示已知店家模式，舊單仍顯示來源', () => {
  assert.match(orderDetailSource, /merchantOrderDisplayLabel\(order\.merchantOrderMode\)/);
  assert.match(orderDetailSource, /<Badge variant="secondary">\{merchantModeLabel\}<\/Badge>/);
  assert.match(
    orderDetailSource,
    /description=\{merchantModeLabel \? `合作方式：\$\{merchantModeLabel\}` : `來源：\$\{order\.source\}`\}/,
  );
});

test('店家只顯示主檔已登記的合作方式', () => {
  assert.deepEqual(
    merchantOrderModesForTypes(['consignment', 'jar_exchange', 'partner']),
    ['consignment', 'jar_exchange'],
  );
});

test('買斷使用獨立訂單來源，寄賣與換罐沿用寄賣來源', () => {
  assert.equal(merchantOrderSource('wholesale'), 'wholesale');
  assert.equal(merchantOrderSource('consignment'), 'consignment');
  assert.equal(merchantOrderSource('jar_exchange'), 'consignment');
});

test('換罐與一般店家商品使用不同產品類型', () => {
  assert.equal(merchantOrderProductCategory('jar_exchange'), 'JAR_EXCHANGE');
  assert.equal(merchantOrderProductCategory('consignment'), 'STANDARD');
  assert.equal(merchantOrderProductCategory('wholesale'), 'STANDARD');
});

test('只有客戶訂單與店家買斷會把商品金額列入應付', () => {
  assert.equal(orderMerchandiseIsBillable('customer', null), true);
  assert.equal(orderMerchandiseIsBillable('merchant', 'wholesale'), true);
  assert.equal(orderMerchandiseIsBillable('merchant', 'consignment'), false);
  assert.equal(orderMerchandiseIsBillable('merchant', 'jar_exchange'), false);
});
