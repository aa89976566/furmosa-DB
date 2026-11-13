import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshotView } from '../snapshot-view';

test('金額超過免運門檻仍顯示來源實收運費，不自行重算', () => {
  for (const fee of ['0.0', '129.00']) {
    const view = snapshotView({ schemaVersion: 1, order: {
      subtotal_price: '2518.5', total_price: fee === '0.0' ? '2518.5' : '2647.5',
      total_shipping_price_set: { shop_money: { amount: fee } },
    } });
    assert.equal(view?.shippingFee, fee);
    assert.equal(view?.subtotal, '2518.5');
  }
});

test('舊快照缺運費不誤顯示為免費', () => {
  assert.equal(snapshotView({ schemaVersion: 1, order: {} })?.shippingFee, '');
});
