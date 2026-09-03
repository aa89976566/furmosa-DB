import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeMerchantUsername, validateMerchantPassword, validateMerchantUsername } from '@/lib/merchant-account-policy';

describe('POS 帳號規則', () => {
  it('帳號統一轉為小寫並移除空白', () => assert.equal(normalizeMerchantUsername(' Store.One '), 'store.one'));
  it('拒絕太短或含中文的帳號', () => {
    assert.ok(validateMerchantUsername('abc'));
    assert.ok(validateMerchantUsername('門市帳號'));
  });
  it('接受可辨識的帳號', () => assert.equal(validateMerchantUsername('store.one-01'), null));
  it('密碼需為 4–8 字且兩次一致', () => {
    assert.ok(validateMerchantPassword('abc', 'abc'));
    assert.ok(validateMerchantPassword('123456789', '123456789'));
    assert.ok(validateMerchantPassword('store123', 'different'));
    assert.equal(validateMerchantPassword('store123', 'store123'), null);
  });
});
