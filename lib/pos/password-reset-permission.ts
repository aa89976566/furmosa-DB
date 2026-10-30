import type { PrismaClient } from '@prisma/client';

export const POS_PASSWORD_RESET_ROLES = new Set(['admin', 'inventory_reviewer']);

export function canResetMerchantPosPassword(role: string | null | undefined) {
  return Boolean(role && POS_PASSWORD_RESET_ROLES.has(role));
}

export async function requirePosPasswordResetPermission(
  db: PrismaClient,
  session: { userId: string } | null,
) {
  const user = session && await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  if (!user || !canResetMerchantPosPassword(user.role)) {
    throw new Error('沒有權限重設店家 POS 密碼');
  }
  return user.id;
}
