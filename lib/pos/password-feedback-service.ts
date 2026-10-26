import { isNextRedirect } from '@/lib/is-next-redirect';

export type PosPasswordFeedbackState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export async function createPosUserWithFeedbackUsing(
  createUser: (formData: FormData) => Promise<unknown>,
  formData: FormData,
): Promise<PosPasswordFeedbackState> {
  try {
    await createUser(formData);
    return { status: 'success', message: 'POS 帳號已建立，請前往 POS 登入。' };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : '';
    const safe = [
      '只有管理員可以管理店家帳號', '缺少店家',
      '帳號需為 4–32 位英文字母、數字、句點、底線或連字號',
      '密碼需為 8–64 位', '此 POS 帳號已存在', '此店家已有啟用中的 POS 帳號',
      'POS 密碼保管功能尚未設定',
    ];
    return { status: 'error', message: safe.includes(message)
      ? message === 'POS 密碼保管功能尚未設定'
        ? '系統尚未設定 POS 密碼加密功能，請聯絡管理員完成設定後再建立帳號。'
        : message
      : '無法確認帳號是否建立，請重新整理查看帳號清單，避免重複建立。' };
  }
}

export async function resetPosPasswordWithFeedbackUsing(
  resetPassword: (formData: FormData) => Promise<unknown>,
  formData: FormData,
): Promise<PosPasswordFeedbackState> {
  try {
    await resetPassword(formData);
    return { status: 'success', message: 'POS 密碼已更新，請使用剛才設定的新密碼登入。' };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : '';
    const safeMessages = [
      '只有管理員可以管理店家帳號',
      '缺少店家或 POS 帳號',
      '密碼需為 8–64 位',
      'POS 帳號不存在或不屬於此店家',
      'POS 密碼保管功能尚未設定',
    ];
    return {
      status: 'error',
      message: safeMessages.includes(message)
        ? message
        : '無法確認密碼是否更新，請先嘗試登入；若仍失敗，請重新設定。',
    };
  }
}
