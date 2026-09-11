import type { PosPasswordState } from '@/app/(main)/merchants/[id]/pos-password-action';

export type PasswordResetReceipt = { username: string; password: string };

/** Browser-memory receipt only. Never send this receipt back as server action state. */
export async function submitPasswordResetWithReceipt(
  previous: PosPasswordState,
  data: FormData,
  users: ReadonlyArray<{ id: string; username: string }>,
  reset: (previous: PosPasswordState, data: FormData) => Promise<PosPasswordState>,
): Promise<{ state: PosPasswordState; receipt: PasswordResetReceipt | null }> {
  // Capture the submitted values before awaiting; later edits must not change the receipt.
  const username = users.find((user) => user.id === data.get('userId'))?.username;
  const password = data.get('password');
  const state = await reset(previous, data);
  return {
    state,
    receipt: state.status === 'success' && username && typeof password === 'string'
      ? { username, password }
      : null,
  };
}
