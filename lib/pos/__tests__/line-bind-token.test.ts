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
  const segments = token.split('.');
  assert.equal(segments.length, 3);
  const signature = segments[2];
  const replacement = signature.startsWith('x') ? 'y' : 'x';
  const tamperedToken = [segments[0], segments[1], `${replacement}${signature.slice(1)}`].join('.');
  await assert.rejects(
    verifyMerchantLineBindToken(tamperedToken),
    /綁定連結已失效/,
  );
});
