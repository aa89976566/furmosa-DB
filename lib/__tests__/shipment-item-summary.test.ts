import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shipmentItemSummary } from '@/lib/shipment-item-summary';

describe('出貨清單商品摘要', () => {
  it('重量商品只顯示名稱、克數與訂購數量', () => {
    assert.equal(
      shipmentItemSummary({
        productName: '牛肉地瓜乾',
        weightGrams: 50,
        quantity: 1,
        packSize: 1,
        packUnit: '包',
      }),
      '牛肉地瓜乾 50g ×1',
    );
  });

  it('組合商品顯示組數及實際出貨總數', () => {
    assert.equal(
      shipmentItemSummary({
        productName: '鴨脖凍乾',
        weightGrams: null,
        quantity: 1,
        packSize: 5,
        packUnit: '隻',
      }),
      '鴨脖凍乾 ×1 組（共 5 隻）',
    );
  });

  it('多組商品正確換算總數', () => {
    assert.equal(
      shipmentItemSummary({
        productName: '鴨脖凍乾',
        weightGrams: null,
        quantity: 3,
        packSize: 5,
        packUnit: '隻',
      }),
      '鴨脖凍乾 ×3 組（共 15 隻）',
    );
  });

  it('組合商品可顯示訂單保存的方案', () => {
    assert.equal(
      shipmentItemSummary({
        productName: '貝貝團購好友限定優惠',
        weightGrams: null,
        quantity: 1,
        variantLabel: '人氣款',
      }),
      '貝貝團購好友限定優惠・人氣款 ×1 組',
    );
  });
});
