import type { Prisma } from '@prisma/client';

export function taiwanWeekStart(now = new Date()) {
  const taiwan = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = taiwan.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return new Date(Date.UTC(
    taiwan.getUTCFullYear(),
    taiwan.getUTCMonth(),
    taiwan.getUTCDate() - daysSinceMonday,
  ) - 8 * 60 * 60 * 1000);
}

export function archivablePendingOrderWhere(before?: Date): Prisma.OrderWhereInput {
  return {
    deletedAt: null,
    archivedAt: null,
    status: 'pending_review',
    OR: [{ omsStatus: null }, { omsStatus: { in: ['NEW', 'REVIEW'] } }],
    ...(before ? { orderedAt: { lt: before } } : {}),
  };
}
