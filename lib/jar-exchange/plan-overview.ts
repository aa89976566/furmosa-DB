import { resolvePetSpeciesLabel } from '@/lib/customers/pet-fields';
import { getMonthJarExchangeKpis } from '@/lib/jar-exchange/stats';
import { resolveSignupStoreLabel } from '@/lib/line/line-copy';
import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import { prisma } from '@/lib/prisma';
import {
  taipeiStartOfLastNDays,
  taipeiTodayRange,
  taipeiWeekRangeSunday,
} from '@/lib/taipei-date';

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

export type RecentJarSignup = {
  id: string;
  customerCode: string;
  name: string;
  phone: string | null;
  lineDisplay: string | null;
  hasLine: boolean;
  petLabel: string | null;
  storeLabel: string | null;
  startedAt: Date;
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
  /** 台北日曆「今天」經 LINE／系統開通換罐的會員 */
  todaySignups: RecentJarSignup[];
  todaySignupCount: number;
};

export async function loadJarPlanOverview(): Promise<JarPlanOverview> {
  const { start: startOfWeek } = taipeiWeekRangeSunday();
  const startOfLast7Days = taipeiStartOfLastNDays(7);
  const { start: startOfToday } = taipeiTodayRange();

  const [
    kpis,
    openGroups,
    openByMerchant,
    completedThisWeek,
    completedLast7Days,
    merchants,
    todaySignupRows,
    todaySignupCount,
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
    prisma.customerService.findMany({
      where: {
        serviceType: 'jar_exchange',
        serviceStatus: 'active',
        startedAt: { gte: startOfToday },
      },
      orderBy: { startedAt: 'desc' },
      take: 12,
      select: {
        startedAt: true,
        customer: {
          select: {
            id: true,
            customerId: true,
            name: true,
            phone: true,
            lineUserId: true,
            lineDisplay: true,
            petName: true,
            petSpecies: true,
            petSpeciesOther: true,
            signupStore: true,
            storeId: true,
            storeName: true,
          },
        },
      },
    }),
    prisma.customerService.count({
      where: {
        serviceType: 'jar_exchange',
        serviceStatus: 'active',
        startedAt: { gte: startOfToday },
      },
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

  const todaySignups: RecentJarSignup[] = todaySignupRows.map((row) => {
    const c = row.customer;
    const petSpecies = resolvePetSpeciesLabel(c.petSpecies, c.petSpeciesOther);
    const petLabel =
      c.petName || petSpecies
        ? [petSpecies, c.petName].filter(Boolean).join(' · ')
        : null;
    return {
      id: c.id,
      customerCode: c.customerId,
      name: c.name,
      phone: c.phone,
      lineDisplay: c.lineDisplay,
      hasLine: Boolean(c.lineUserId),
      petLabel,
      storeLabel:
        c.storeName ??
        resolveSignupStoreLabel(c.signupStore ?? c.storeId) ??
        null,
      startedAt: row.startedAt,
    };
  });

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
    todaySignups,
    todaySignupCount,
  };
}
