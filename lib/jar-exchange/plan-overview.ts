import { getMonthJarExchangeKpis } from '@/lib/jar-exchange/stats';
import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import { prisma } from '@/lib/prisma';
import { taipeiStartOfLastNDays, taipeiWeekRangeSunday } from '@/lib/taipei-date';

const OPEN_REFILL_STATUSES = [
  'payment_pending',
  'paid_waiting_return',
  'old_container_verified',
  'awaiting_extra_payment',
] as const;

export type PosConnectionRow = {
  merchantId: string;
  merchantCode: string;
  name: string;
  city: string | null;
  isJarExchange: boolean;
  userCount: number;
  activeUserCount: number;
  lastLoginAt: Date | null;
  openRefillCount: number;
};

export type JarPlanOverview = {
  kpis: Awaited<ReturnType<typeof getMonthJarExchangeKpis>>;
  refill: {
    openTotal: number;
    paymentPending: number;
    waitingReturn: number;
    verified: number;
    awaitingExtra: number;
    completedThisWeek: number;
    completedLast7Days: number;
  };
  posConnections: PosConnectionRow[];
  summary: {
    jarMerchantCount: number;
    posLinkedCount: number;
    posActiveIn7dCount: number;
    neverLoggedInCount: number;
  };
};

export async function loadJarPlanOverview(): Promise<JarPlanOverview> {
  const { start: startOfWeek } = taipeiWeekRangeSunday();
  const startOfLast7Days = taipeiStartOfLastNDays(7);

  const [
    kpis,
    openGroups,
    openByMerchant,
    completedThisWeek,
    completedLast7Days,
    merchants,
  ] = await Promise.all([
    getMonthJarExchangeKpis(),
    prisma.refillOrder.groupBy({
      by: ['status'],
      where: { status: { in: [...OPEN_REFILL_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.refillOrder.groupBy({
      by: ['merchantId'],
      where: { status: { in: [...OPEN_REFILL_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.refillOrder.count({
      where: {
        status: 'completed',
        completedAt: { gte: startOfWeek },
      },
    }),
    prisma.refillOrder.count({
      where: {
        status: 'completed',
        completedAt: { gte: startOfLast7Days },
      },
    }),
    prisma.merchant.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        merchantId: true,
        name: true,
        city: true,
        type: true,
        users: {
          select: {
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    openGroups.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const openRefillByMerchant = new Map(
    openByMerchant.map((row) => [row.merchantId, row._count._all]),
  );

  const typesMap = await getMerchantTypesMap(
    prisma,
    merchants.map((m) => ({ id: m.id, type: m.type })),
  );

  const jarMerchants = merchants.filter((m) =>
    (typesMap.get(m.id) ?? ['consignment']).includes('jar_exchange'),
  );

  // Also include merchants with open refill or POS users even if type not tagged
  const relevant = merchants.filter((m) => {
    const types = typesMap.get(m.id) ?? ['consignment'];
    return (
      types.includes('jar_exchange') ||
      m.users.length > 0 ||
      (openRefillByMerchant.get(m.id) ?? 0) > 0
    );
  });

  const posConnections: PosConnectionRow[] = relevant.map((m) => {
    const lastLoginAt =
      m.users
        .map((u) => u.lastLoginAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return {
      merchantId: m.id,
      merchantCode: m.merchantId,
      name: m.name,
      city: m.city,
      isJarExchange: (typesMap.get(m.id) ?? []).includes('jar_exchange'),
      userCount: m.users.length,
      activeUserCount: m.users.filter((u) => u.isActive).length,
      lastLoginAt,
      openRefillCount: openRefillByMerchant.get(m.id) ?? 0,
    };
  });

  posConnections.sort((a, b) => {
    // Open refill first, then never logged in, then by last login
    if (b.openRefillCount !== a.openRefillCount) {
      return b.openRefillCount - a.openRefillCount;
    }
    if (!!a.lastLoginAt !== !!b.lastLoginAt) {
      return a.lastLoginAt ? 1 : -1;
    }
    if (a.lastLoginAt && b.lastLoginAt) {
      return b.lastLoginAt.getTime() - a.lastLoginAt.getTime();
    }
    return a.name.localeCompare(b.name, 'zh-Hant');
  });

  const jarMerchantCount = jarMerchants.length;
  const posLinkedCount = jarMerchants.filter((m) => m.users.length > 0).length;
  const posActiveIn7dCount = jarMerchants.filter((m) =>
    m.users.some(
      (u) => u.lastLoginAt && u.lastLoginAt.getTime() >= startOfLast7Days.getTime(),
    ),
  ).length;
  const neverLoggedInCount = jarMerchants.filter(
    (m) => m.users.length > 0 && m.users.every((u) => !u.lastLoginAt),
  ).length;

  const paymentPending = countByStatus.payment_pending ?? 0;
  const waitingReturn = countByStatus.paid_waiting_return ?? 0;
  const verified = countByStatus.old_container_verified ?? 0;
  const awaitingExtra = countByStatus.awaiting_extra_payment ?? 0;

  return {
    kpis,
    refill: {
      openTotal: paymentPending + waitingReturn + verified + awaitingExtra,
      paymentPending,
      waitingReturn,
      verified,
      awaitingExtra,
      completedThisWeek,
      completedLast7Days,
    },
    posConnections,
    summary: {
      jarMerchantCount,
      posLinkedCount,
      posActiveIn7dCount,
      neverLoggedInCount,
    },
  };
}
