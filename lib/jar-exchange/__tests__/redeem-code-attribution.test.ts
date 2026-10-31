import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveJarCodeMerchantId } from '../merchant-attribution.ts';

test('店家專用序號優先於會員原本的店家歸屬', () => {
  assert.equal(
    resolveJarCodeMerchantId('merchant-manlisa', 'merchant-member-home'),
    'merchant-manlisa',
  );
});

test('會員未綁定店家時仍依店家專用序號歸屬', () => {
  assert.equal(resolveJarCodeMerchantId('merchant-manlisa', null), 'merchant-manlisa');
});

test('舊序號沒有發放店家時維持會員店家歸屬', () => {
  assert.equal(resolveJarCodeMerchantId(null, 'merchant-member-home'), 'merchant-member-home');
});

test('舊序號與會員都沒有店家時維持既有空值行為', () => {
  assert.equal(resolveJarCodeMerchantId(null, null), null);
});
