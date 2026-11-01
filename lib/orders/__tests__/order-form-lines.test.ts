import assert from 'node:assert/strict';
import test from 'node:test';
import { writeOrderFormLines } from '../order-form-lines';

const base = { productId: 'jar-fish', tierId: '15g', quantity: 2, unitPrice: 0,
  weightGrams: 15, unit: 'g', isGift: false };

test('換罐明細不依賴折疊或尚未掛載的表單控制項，並保留其他訂單欄位', () => {
  const form = new FormData();
  form.set('merchantOrderMode', 'jar_exchange');
  form.append('productId', '');
  form.append('productId', 'stale-product');
  form.append('quantity', '0');
  writeOrderFormLines(form, [{ ...base, productId: '' }, base]);
  assert.deepEqual(form.getAll('productId'), ['jar-fish']);
  assert.deepEqual(form.getAll('quantity'), ['2']);
  assert.deepEqual(form.getAll('tierId'), ['15g']);
  assert.deepEqual(form.getAll('unitPrice'), ['0']);
  assert.equal(form.get('merchantOrderMode'), 'jar_exchange');
});

test('一般商品與贈品各欄位保持逐列對齊，重試不重複商品', () => {
  const form = new FormData();
  const lines = [base, { ...base, productId: 'gift', isGift: true, weightGrams: 10,
    unitPrice: 99 }, { ...base, productId: 'wholesale', commercialOverrideEnabled: true,
    commercialOverrideMode: 'fixed_price', commercialOverrideValue: 80,
    commercialOverrideReason: '店家協議價格' }];
  writeOrderFormLines(form, lines);
  writeOrderFormLines(form, lines);
  assert.deepEqual(form.getAll('productId'), ['jar-fish', 'gift', 'wholesale']);
  assert.deepEqual(form.getAll('giftWeightGrams'), ['', '10', '']);
  assert.deepEqual(form.getAll('lineIsGift'), ['0', '1', '0']);
  assert.deepEqual(form.getAll('commercialOverrideValue'), ['', '', '80']);
  assert.deepEqual(form.getAll('unitPrice'), ['0', '0', '0']);
});
