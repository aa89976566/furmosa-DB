import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { before, it } from 'node:test';

let failure: unknown;
let received: FormData | undefined;
const fakeReset = async (data: FormData) => { received = data; if (failure) throw failure; };
(globalThis as typeof globalThis & { __RESET_POS_TEST__: typeof fakeReset }).__RESET_POS_TEST__ = fakeReset;
const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === './actions' && context.parentURL.includes('pos-password-action')) {
    return { shortCircuit: true, url: 'data:text/javascript,export const resetMerchantPosUserPassword = globalThis.__RESET_POS_TEST__;' };
  }
  return nextResolve(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
const moduleApi = Module as unknown as { _load: (request: string, parent: { filename?: string }, isMain: boolean) => unknown };
let reset: typeof import('@/app/(main)/merchants/[id]/pos-password-action').resetPosPasswordWithFeedback;
before(async () => {
  const original = moduleApi._load;
  moduleApi._load = function(request, parent, isMain) {
    if (request === './actions' && parent?.filename?.includes('pos-password-action')) return { resetMerchantPosUserPassword: fakeReset };
    return original.call(this, request, parent, isMain);
  };
  try { ({ resetPosPasswordWithFeedback: reset } = await import('@/app/(main)/merchants/[id]/pos-password-action')); }
  finally { moduleApi._load = original; }
});
it('reports success only after the existing secured reset action resolves', async () => {
  failure = undefined;
  const data = new FormData();
  data.set('merchantId', 'm1'); data.set('userId', 'u2'); data.set('password', 'test-only-password');
  const result = await reset({ status: 'idle', message: '' }, data);
  assert.equal(received, data);
  assert.equal(result.status, 'success');
  assert.equal(JSON.stringify(result).includes('test-only-password'), false);
});
it('returns safe validation and ownership feedback without claiming success', async () => {
  for (const message of ['密碼需為 8–64 位', '只有管理員可以管理店家帳號', 'POS 帳號不存在或不屬於此店家']) {
    failure = new Error(message);
    assert.deepEqual(await reset({ status: 'idle', message: '' }, new FormData()), { status: 'error', message });
  }
});
it('does not expose unexpected error details or claim that no update occurred', async () => {
  failure = new Error('private database detail');
  const result = await reset({ status: 'idle', message: '' }, new FormData());
  assert.equal(result.status, 'error');
  assert.match(result.message, /無法確認/);
  assert.equal(result.message.includes('private database detail'), false);
});
it('preserves authentication redirects', async () => {
  failure = { digest: 'NEXT_REDIRECT;replace;/login;307;' };
  await assert.rejects(reset({ status: 'idle', message: '' }, new FormData()), (error) => error === failure);
});
