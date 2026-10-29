import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const load = (Module as any)._load.bind(Module);
let submitted: any;
let failure: string | null = null;
(Module as any)._load = (request: string, ...args: any[]) => {
  if (request === 'next/cache') return { revalidatePath() {} };
  if (request.endsWith('/merchant-auth')) return {
    requireMerchantSession: async () => ({ merchantId: 'm', merchantUserId: 'u' }),
    getAuthenticatedMerchantId: async () => 'm',
  };
  if (request.endsWith('/restock-request/service')) return { submitSelfSelectRestockRequest: async (input: any) => {
    submitted = input;
    if (failure) throw new Error(failure);
    return { id: 'request' };
  } };
  if (request.endsWith('/pos/adjust-store-stock')) return {};
  return load(request, ...args);
};
const { submitInventoryRestockCartAction } = require('../../../app/pos/stock/actions');
test('快速補貨保留規格與登入店家，失敗時回傳具體規格錯誤', async () => {
  const items = [{ productId: 'duck', quantity: 2, variantKey: 'duck50' }];
  assert.deepEqual(await submitInventoryRestockCartAction(items), { ok: true, requestId: 'request' });
  assert.equal(submitted.merchantId, 'm');
  assert.equal(submitted.merchantUserId, 'u');
  assert.deepEqual(submitted.items, items);
  failure = '「鴨肺」請選擇具體規格，不能自動猜測。';
  assert.deepEqual(await submitInventoryRestockCartAction(items), { ok: false, error: failure });
});
