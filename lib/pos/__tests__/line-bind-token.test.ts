import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMerchantLineBindToken,
  verifyMerchantLineBindToken,
} from '@/lib/pos/line-bind-token';

test('LINE 綁定 token 只還原伺服器簽署的店家', async () => {
  process.env.AUTH_SECRET = 'test-secret-for-merchant-line-binding';
  const token = await createMerchantLineBindToken('merchant-123');
  assert.equal(await verifyMerchantLineBindToken(token), 'merchant-123');
});

test('LINE 綁定 token 拒絕竄改內容', async () => {
  process.env.AUTH_SECRET = 'test-secret-for-merchant-line-binding';
  const token = await createMerchantLineBindToken('merchant-123');
  await assert.rejects(
    verifyMerchantLineBindToken(`${token.slice(0, -1)}x`),
    /綁定連結已失效/,
  );
});
