import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLogisticsFromShipment } from '../logistics-display';

test('超商出貨隊列優先顯示門市名稱與店號，而不是完整地址', () => {
  const view = resolveLogisticsFromShipment({
    type: 'customer_order',
    carrier: '711',
    recipientName: '高稚媛',
    recipientPhone: '0912345678',
    recipientAddress: '366 苗栗縣銅鑼鄉銅鑼村中正路6之25號',
    order: {
      shippingMethod: 'convenience',
      cvsBrand: '711',
      cvsStoreId: '123456',
      cvsStoreName: '銅鑼',
    },
  });

  assert.equal(view.destination, '銅鑼門市（店號 123456）');
  assert.equal(view.contactName, '高稚媛');
});

test('宅配仍顯示出貨單的收件地址', () => {
  const view = resolveLogisticsFromShipment({
    type: 'customer_order',
    recipientAddress: '台北市信義區測試路1號',
    order: { shippingMethod: 'home' },
  });

  assert.equal(view.destination, '台北市信義區測試路1號');
});
