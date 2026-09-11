import assert from 'node:assert/strict';
import { it } from 'node:test';
import { submitPasswordResetWithReceipt } from '@/lib/pos/password-reset-receipt';
import type { PosPasswordState } from '@/app/(main)/merchants/[id]/pos-password-action';

const initial: PosPasswordState = { status: 'idle', message: '' };
const users = [{ id: 'u1', username: 'first' }, { id: 'u2', username: 'second' }];
function submission() {
  const data = new FormData();
  data.set('userId', 'u2');
  data.set('password', ' test-only-secret ');
  return data;
}
it('shows the exact submitted password only for the selected account after success', async () => {
  const result = await submitPasswordResetWithReceipt(initial, submission(), users, async (previous) => {
    assert.deepEqual(previous, initial); // Receipt is not sent back to the server.
    return { status: 'success', message: 'updated' };
  });
  assert.deepEqual(result.receipt, { username: 'second', password: ' test-only-secret ' });
  assert.equal(JSON.stringify(result.state).includes('test-only-secret'), false);
});
it('does not show a password after a rejected reset or an unknown account', async () => {
  assert.equal((await submitPasswordResetWithReceipt(initial, submission(), users, async () => ({ status: 'error', message: 'rejected' }))).receipt, null);
  assert.equal((await submitPasswordResetWithReceipt(initial, submission(), [], async () => ({ status: 'success', message: 'updated' }))).receipt, null);
});
it('captures the submitted password before waiting for the server response', async () => {
  const data = submission();
  const result = await submitPasswordResetWithReceipt(initial, data, users, async () => {
    data.set('password', 'different-later-input');
    return { status: 'success', message: 'updated' };
  });
  assert.equal(result.receipt?.password, ' test-only-secret ');
});
it('does not fabricate success or a receipt on a transport failure', async () => {
  await assert.rejects(submitPasswordResetWithReceipt(initial, submission(), users, async () => { throw new Error('network'); }), /network/);
});
