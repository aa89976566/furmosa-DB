import assert from 'node:assert/strict';
import test from 'node:test';
import { merchantShippingIssue } from '../merchant-shipping-status';

test('未設定物流時提示去編輯，不虛構門市或地址', () => {
  const issue = merchantShippingIssue({
    preferredCarrier: null,
    pickupStoreName: null,
    address: null,
  });
  assert.equal(issue?.code, 'carrier_missing');
  assert.match(issue?.action ?? '', /編輯/);
  assert.equal(issue?.action.includes('7-11 ·'), false);
});

test('7-11 缺門市時要求補門市，不猜測門市名', () => {
  const issue = merchantShippingIssue({
    preferredCarrier: '7-11',
    pickupStoreName: '  ',
    address: null,
  });
  assert.equal(issue?.code, 'cvs_store_missing');
  assert.match(issue?.message ?? '', /門市/);
});

test('送貨或缺地址時要求補地址', () => {
  const issue = merchantShippingIssue({
    preferredCarrier: '送貨',
    pickupStoreName: null,
    address: '',
  });
  assert.equal(issue?.code, 'address_missing');
  assert.match(issue?.message ?? '', /送貨地址/);
});

test('物流完整時不提示', () => {
  assert.equal(
    merchantShippingIssue({
      preferredCarrier: '7-11',
      pickupStoreName: '淡水復興門市',
      address: null,
    }),
    null,
  );
  assert.equal(
    merchantShippingIssue({
      preferredCarrier: '黑貓',
      pickupStoreName: null,
      address: '新北市淡水區北新路218號',
    }),
    null,
  );
});
