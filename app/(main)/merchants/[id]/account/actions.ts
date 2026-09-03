'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import {
  normalizeMerchantUsername,
  validateMerchantPassword,
  validateMerchantUsername,
} from '@/lib/merchant-account-policy';
import { prisma } from '@/lib/prisma';

export type MerchantAccountActionState = { message: string; ok?: boolean };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new Error('只有 HQ 管理員可以管理 POS 帳號');
  return user;
}

function refresh(merchantId: string) {
  revalidatePath(`/merchants/${merchantId}/account`);
  revalidatePath(`/merchants/${merchantId}`);
}

export async function createMerchantAccountAction(
  _previous: MerchantAccountActionState,
  formData: FormData,
): Promise<MerchantAccountActionState> {
  try {
    const actor = await requireAdmin();
    const merchantId = String(formData.get('merchantId') ?? '');
    const username = normalizeMerchantUsername(String(formData.get('username') ?? ''));
    const displayName = String(formData.get('displayName') ?? '').trim() || null;
    const password = String(formData.get('password') ?? '');
    const confirmation = String(formData.get('passwordConfirmation') ?? '');
    if (!merchantId) return { message: '缺少店家資料' };
    const usernameError = validateMerchantUsername(username);
    if (usernameError) return { message: usernameError };
    const passwordError = validateMerchantPassword(password, confirmation);
    if (passwordError) return { message: passwordError };

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, status: true, users: { select: { id: true }, take: 1 } },
    });
    if (!merchant) return { message: '找不到店家' };
    if (merchant.users.length > 0) return { message: '此店家已建立 POS 帳號，請直接管理現有帳號' };
    if (merchant.status !== 'active') return { message: '店家尚未啟用，無法開通 POS 帳號' };

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const account = await tx.merchantUser.create({
        data: { merchantId, username, displayName, passwordHash, isActive: true },
      });
      await tx.statusAuditLog.create({
        data: {
          entityType: 'merchant_user',
          entityId: account.id,
          previousStatus: null,
          newStatus: 'ACTIVE',
          actorType: 'supervisor',
          actorId: actor.userId,
          metadataJson: JSON.stringify({ action: 'CREATE', merchantId }),
        },
      });
    });
    refresh(merchantId);
    return { ok: true, message: 'POS 帳號已開通' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { message: '這個帳號已被使用，請換一個帳號' };
    }
    return { message: error instanceof Error ? error.message : '帳號建立失敗' };
  }
}

export async function resetMerchantPasswordAction(
  _previous: MerchantAccountActionState,
  formData: FormData,
): Promise<MerchantAccountActionState> {
  try {
    const actor = await requireAdmin();
    const merchantId = String(formData.get('merchantId') ?? '');
    const accountId = String(formData.get('accountId') ?? '');
    const password = String(formData.get('password') ?? '');
    const confirmation = String(formData.get('passwordConfirmation') ?? '');
    const passwordError = validateMerchantPassword(password, confirmation);
    if (passwordError) return { message: passwordError };

    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async (tx) => {
      const update = await tx.merchantUser.updateMany({
        where: { id: accountId, merchantId },
        data: { passwordHash },
      });
      if (update.count === 1) {
        await tx.statusAuditLog.create({
          data: {
            entityType: 'merchant_user', entityId: accountId,
            previousStatus: null, newStatus: 'PASSWORD_RESET',
            actorType: 'supervisor', actorId: actor.userId,
            metadataJson: JSON.stringify({ action: 'PASSWORD_RESET', merchantId }),
          },
        });
      }
      return update;
    });
    if (result.count !== 1) return { message: '找不到這個 POS 帳號' };
    refresh(merchantId);
    return { ok: true, message: '密碼已更新' };
  } catch (error) {
    return { message: error instanceof Error ? error.message : '密碼更新失敗' };
  }
}

export async function setMerchantAccountActiveAction(
  _previous: MerchantAccountActionState,
  formData: FormData,
): Promise<MerchantAccountActionState> {
  try {
    const actor = await requireAdmin();
    const merchantId = String(formData.get('merchantId') ?? '');
    const accountId = String(formData.get('accountId') ?? '');
    const nextActive = String(formData.get('nextActive')) === 'true';
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { status: true },
    });
    if (!merchant) return { message: '找不到店家' };
    if (nextActive && merchant.status !== 'active') {
      return { message: '店家尚未啟用，無法重新啟用 POS 帳號' };
    }
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.merchantUser.findFirst({
        where: { id: accountId, merchantId }, select: { isActive: true },
      });
      if (!existing) return { count: 0 };
      if (existing.isActive === nextActive) return { count: 1 };
      const update = await tx.merchantUser.updateMany({
        where: { id: accountId, merchantId }, data: { isActive: nextActive },
      });
      await tx.statusAuditLog.create({
        data: {
          entityType: 'merchant_user', entityId: accountId,
          previousStatus: existing.isActive ? 'ACTIVE' : 'INACTIVE',
          newStatus: nextActive ? 'ACTIVE' : 'INACTIVE',
          actorType: 'supervisor', actorId: actor.userId,
          metadataJson: JSON.stringify({ action: nextActive ? 'ACTIVATE' : 'DEACTIVATE', merchantId }),
        },
      });
      return update;
    });
    if (result.count !== 1) return { message: '找不到這個 POS 帳號' };
    refresh(merchantId);
    return { ok: true, message: nextActive ? 'POS 帳號已重新啟用' : 'POS 帳號已停用' };
  } catch (error) {
    return { message: error instanceof Error ? error.message : '帳號狀態更新失敗' };
  }
}
