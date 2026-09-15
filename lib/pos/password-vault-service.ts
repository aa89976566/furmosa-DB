import type { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';
import { encryptPosPassword, decryptPosPassword } from './password-vault';

export async function requirePasswordAdmin(db: PrismaClient, session: { userId: string } | null) {
  const user = session && await db.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!user || user.role !== 'admin') throw new Error('只有管理員可以查看或保存店家密碼');
  return user.id;
}

export async function accessPosPassword(
  db: PrismaClient,
  session: { userId: string } | null,
  input: { merchantId: string; userId: string; password?: string },
) {
  const adminId = await requirePasswordAdmin(db, session);
  if (!input.merchantId || !input.userId) throw new Error('缺少店家或 POS 帳號');
  const user = await db.merchantUser.findFirst({
    where: { id: input.userId, merchantId: input.merchantId },
    select: { id: true, passwordHash: true, encryptedPassword: true },
  });
  if (!user) throw new Error('POS 帳號不存在或不屬於此店家');

  if (input.password !== undefined) {
    if (input.password.length < 8 || input.password.length > 64 || !(await compare(input.password, user.passwordHash))) {
      throw new Error('目前密碼不正確，尚未保存');
    }
    const encryptedPassword = encryptPosPassword(input.password, user.id, user.passwordHash);
    await db.$transaction(async (tx) => {
      // Compare-and-set prevents saving a stale password during a concurrent reset.
      const result = await tx.merchantUser.updateMany({
        where: { id: user.id, merchantId: input.merchantId, passwordHash: user.passwordHash },
        data: { encryptedPassword },
      });
      if (result.count !== 1) throw new Error('密碼已變更，請重新確認');
      await tx.posPasswordAccessLog.create({ data: { adminId, merchantUserId: user.id, action: 'save' } });
    });
    return { status: 'saved' as const };
  }
  if (!user.encryptedPassword) return { status: 'missing' as const };
  const password = decryptPosPassword(user.encryptedPassword, user.id, user.passwordHash);
  // Fail closed: return the plaintext only after the audit write succeeds.
  await db.posPasswordAccessLog.create({ data: { adminId, merchantUserId: user.id, action: 'reveal' } });
  return { status: 'revealed' as const, password };
}
