'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type PosAccessState = { error: string | null; ok?: boolean };

export async function createPosAccessAction(
  merchantId: string,
  _previous: PosAccessState,
  formData: FormData,
): Promise<PosAccessState> {
  const user = await getCurrentUser();
  if (!user) return { error: '請先登入總部帳號' };

  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

  if (!/^[a-z0-9._-]{4,40}$/.test(username)) {
    return { error: '帳號需為 4–40 個英文字母、數字、句點、底線或連字號' };
  }
  if (password.length < 8) return { error: '密碼至少需要 8 個字元' };
  if (password !== passwordConfirm) return { error: '兩次輸入的密碼不同' };

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true },
  });
  if (!merchant) return { error: '找不到這家店' };

  const activeCount = await prisma.merchantUser.count({
    where: { merchantId, isActive: true },
  });
  if (activeCount > 0) return { error: '這家店已有使用中的 POS 帳號' };

  try {
    await prisma.merchantUser.create({
      data: {
        merchantId,
        username,
        displayName: displayName || null,
        passwordHash: await bcrypt.hash(password, 10),
        isActive: true,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return { error: '這個帳號已有人使用，請換一個帳號' };
    }
    return { error: error instanceof Error ? error.message : '建立 POS 帳號失敗' };
  }

  revalidatePath(`/merchants/${merchantId}/pos-access`);
  return { error: null, ok: true };
}
