import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPosUserWithFeedbackUsing } from '../password-feedback-service.ts';

test('missing vault configuration returns an actionable error instead of crashing the page', async () => {
  const result = await createPosUserWithFeedbackUsing(async () => { throw new Error('POS 密碼保管功能尚未設定'); }, new FormData());
  assert.equal(result.status, 'error');
  assert.match(result.message, /系統尚未設定 POS 密碼加密/);
});
test('account creation feedback preserves auth redirects and hides unexpected errors', async () => {
  const redirect = { digest: 'NEXT_REDIRECT;replace;/login;307;' };
  await assert.rejects(createPosUserWithFeedbackUsing(async () => { throw redirect; }, new FormData()), error => error === redirect);
  const result = await createPosUserWithFeedbackUsing(async () => { throw new Error('private connection details'); }, new FormData());
  assert.equal(result.status, 'error');
  assert.match(result.message, /無法確認帳號是否建立/);
  assert.ok(!result.message.includes('private'));
});
test('account creation succeeds only after secured action resolves', async () => {
  const form = new FormData();
  let called = false;
  const result = await createPosUserWithFeedbackUsing(async data => { assert.equal(data, form); called = true; }, form);
  assert.equal(called, true);
  assert.equal(result.status, 'success');
});
