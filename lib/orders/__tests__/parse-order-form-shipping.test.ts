import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOrderFormData } from '../parse-order-form';

function hqForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('orderType', 'customer');
  fd.set('shippingMethod', 'home');
  fd.set('recipientName', '王小明');
  fd.set('recipientPhone', '0912345678');
  fd.set('shippingAddress', '新北市淡水區測試路 1 號');
  for (const [key, value] of Object.entries(overrides)) {
    if (value === '') fd.delete(key);
    else fd.set(key, value);
  }
  return fd;
}

test('HQ home 缺姓名、電話或地址拒絕', async () => {
  await assert.rejects(
    () => parseOrderFormData(hqForm({ recipientName: '' })),
    /請填寫收件人姓名/,
  );
  await assert.rejects(
    () => parseOrderFormData(hqForm({ recipientPhone: '' })),
    /請填寫收件人電話/,
  );
  await assert.rejects(
    () => parseOrderFormData(hqForm({ shippingAddress: '' })),
    /請填寫收件地址/,
  );
});

test('HQ delivery 缺任一欄拒絕，填齊後通過物流檢查', async () => {
  await assert.rejects(
    () => parseOrderFormData(hqForm({ shippingMethod: 'delivery', shippingAddress: '' })),
    /請填寫收件地址/,
  );
  await assert.rejects(
    () =>
      parseOrderFormData(
        hqForm({
          shippingMethod: 'delivery',
          recipientName: '王小明',
          recipientPhone: '0912345678',
          shippingAddress: '新北市淡水區測試路 1 號',
        }),
      ),
    /請選擇客戶來源/,
  );
});

test('HQ home 填齊後通過物流檢查', async () => {
  await assert.rejects(() => parseOrderFormData(hqForm()), /請選擇客戶來源/);
});

test('HQ 未知或空 shippingMethod throw，不收成 home', async () => {
  await assert.rejects(
    () => parseOrderFormData(hqForm({ shippingMethod: '' })),
    /請選擇運送方式/,
  );
  await assert.rejects(
    () => parseOrderFormData(hqForm({ shippingMethod: 'black_cat' })),
    /請選擇運送方式/,
  );
});

test('HQ convenience／7-11 既有門市檢查不變，缺地址不套宅配規則', async () => {
  await assert.rejects(
    () =>
      parseOrderFormData(
        hqForm({
          shippingMethod: 'convenience',
          cvsBrand: '711',
          cvsStoreName: '',
          shippingAddress: '',
        }),
      ),
    /請填寫門市名稱/,
  );
  await assert.rejects(
    () =>
      parseOrderFormData(
        hqForm({
          shippingMethod: 'convenience',
          cvsBrand: '711',
          cvsStoreName: '淡水復興門市',
          shippingAddress: '',
          recipientPhone: '',
        }),
      ),
    /請選擇客戶來源/,
  );
});
