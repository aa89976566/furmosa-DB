'use server';

import { resetMerchantPosUserPassword } from './actions';
import { isNextRedirect } from '@/lib/is-next-redirect';

export type PosPasswordState = { status: 'idle' | 'success' | 'error'; message: string };

export async function resetPosPasswordWithFeedback(
  _previous: PosPasswordState,
  formData: FormData,
): Promise<PosPasswordState> {
  try {
    // Keep the existing admin, merchant ownership, validation and hashing checks.
    await resetMerchantPosUserPassword(formData);
    return { status: 'success', message: 'POS 密碼已更新，請使用剛才設定的新密碼登入。' };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : '';
    const safeMessages = [
      '只有管理員可以管理店家帳號',
      '缺少店家或 POS 帳號',
      '密碼需為 8–64 位',
      'POS 帳號不存在或不屬於此店家',
    ];
    return {
      status: 'error',
      message: safeMessages.includes(message) ? message : '無法確認密碼是否更新，請先嘗試登入；若仍失敗，請重新設定。',
    };
  }
}
