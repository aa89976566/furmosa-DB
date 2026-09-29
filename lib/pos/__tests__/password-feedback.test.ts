import assert from 'node:assert/strict';
import { it } from 'node:test';
import { resetPosPasswordWithFeedbackUsing } from '../password-feedback-service.ts';

let failure: unknown;
let received: FormData | undefined;
const fakeReset = async (data: FormData) => {
  received = data;
  if (failure) throw failure;
};

it('reports success only after the existing secured reset action resolves', async () => {
  failure = undefined;
  const data = new FormData();
  data.set('merchantId', 'm1');
  data.set('userId', 'u2');
  data.set('password', 'test-only-password');
  const result = await resetPosPasswordWithFeedbackUsing(fakeReset, data);
  assert.equal(received, data);
  assert.equal(result.status, 'success');
  assert.equal(JSON.stringify(result).includes('test-only-password'), false);
});

it('returns safe validation and ownership feedback without claiming success', async () => {
  for (const message of ['密碼需為 8–64 位', '只有管理員可以管理店家帳號', 'POS 帳號不存在或不屬於此店家']) {
    failure = new Error(message);
    assert.deepEqual(await resetPosPasswordWithFeedbackUsing(fakeReset, new FormData()), {
      status: 'error',
      message,
    });
  }
});

it('does not expose unexpected error details or claim that no update occurred', async () => {
  failure = new Error('private database detail');
  const result = await resetPosPasswordWithFeedbackUsing(fakeReset, new FormData());
  assert.equal(result.status, 'error');
  assert.match(result.message, /無法確認/);
  assert.equal(result.message.includes('private database detail'), false);
});

it('preserves authentication redirects', async () => {
  failure = { digest: 'NEXT_REDIRECT;replace;/login;307;' };
  await assert.rejects(
    resetPosPasswordWithFeedbackUsing(fakeReset, new FormData()),
    (error) => error === failure,
  );
});
