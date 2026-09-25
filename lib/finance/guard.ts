import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { evaluateFinanceDbRole } from '@/lib/finance/access-policy';
import { prisma } from '@/lib/prisma';

export class FinanceAccessError extends Error {
  readonly status = 403;

  constructor(message = '只有最高權限管理員可以查看或修改財務與單位經濟') {
    super(message);
    this.name = 'FinanceAccessError';
  }
}

export const isHqFinanceAdmin = cache(async (): Promise<boolean> => {
  try {
    const session = await getCurrentUser();
    if (!session) return false;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });
    return evaluateFinanceDbRole({ hasSession: true, dbRole: user?.role ?? null }) === 'allow';
  } catch {
    return false;
  }
});

export async function requireFinanceAdmin(): Promise<{ userId: string; role: 'admin' }> {
  const session = await getCurrentUser();
  if (!session) redirect('/login?next=/finance/products');
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (evaluateFinanceDbRole({ hasSession: true, dbRole: user?.role ?? null }) !== 'allow') {
    throw new FinanceAccessError();
  }
  return { userId: session.userId, role: 'admin' };
}
