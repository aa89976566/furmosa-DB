import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMerchantLineUserId } from '../notification-settings';

test('店家 LINE User ID 會去除前後空白', () => {
  assert.equal(normalizeMerchantLineUserId('  U123abc  '), 'U123abc');
});

test('空白代表未綁定 LINE', () => {
  assert.equal(normalizeMerchantLineUserId('   '), null);
  assert.equal(normalizeMerchantLineUserId(null), null);
});

test('拒絕不是 U 開頭的店家 LINE User ID', () => {
  assert.throws(
    () => normalizeMerchantLineUserId('C123abc'),
    /LINE User ID 必須是 U 開頭的英數字/,
  );
});
