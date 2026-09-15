import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRestockShipping } from '../shipping';
const merchant = { preferredCarrier: '送貨', contactName: '收件人', phone: '0912345678', address: '測試地址' };

test('missing and unknown carriers block conversion rather than defaulting to delivery', () => {
  for (const preferredCarrier of [null, '', 'unknown']) {
    assert.throws(() => resolveRestockShipping({ ...merchant, preferredCarrier }), /物流方式/);
  }
});
test('home and delivery require all recipient fields', () => {
  for (const preferredCarrier of ['黑貓', '送貨']) {
    for (const [field, message] of [['contactName','姓名'], ['phone','電話'], ['address','地址']]) {
      assert.throws(() => resolveRestockShipping({ ...merchant, preferredCarrier, [field]: ' ' }), new RegExp(message));
    }
    assert.equal(resolveRestockShipping({ ...merchant, preferredCarrier }).recipientAddress, merchant.address);
  }
});
test('7-11 uses the saved pickup store rather than a home address and still requires recipient details', () => {
  const cvs = { ...merchant, preferredCarrier: '7-11', pickupStoreName: '測試門市' };
  assert.equal(resolveRestockShipping(cvs).recipientAddress, '7-11 · 測試門市');
  assert.throws(() => resolveRestockShipping({ ...cvs, pickupStoreName: '' }), /取件門市/);
  assert.throws(() => resolveRestockShipping({ ...cvs, phone: '' }), /電話/);
  assert.throws(() => resolveRestockShipping({ ...cvs, contactName: '' }), /姓名/);
});
