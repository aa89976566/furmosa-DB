'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { accessPosPassword } from '@/lib/pos/password-vault-service';

export async function manageSavedPosPassword(input: { merchantId: string; userId: string; password?: string }) {
  try {
    return await accessPosPassword(prisma, await getCurrentUser(), input);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safeMessages = [
      '只有管理員可以查看或保存店家密碼', '缺少店家或 POS 帳號',
      'POS 帳號不存在或不屬於此店家', '目前密碼不正確，尚未保存',
      '密碼已變更，請重新確認', 'POS 密碼保管功能尚未設定',
    ];
    return { status: 'error' as const, message: safeMessages.includes(message) ? message : '無法讀取已保存密碼，請重新驗證並保存目前密碼。' };
  }
}
