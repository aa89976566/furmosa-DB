import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { withDbRetry } from '@/lib/prisma-retry';
import { CACHE_TAGS } from '@/lib/cache-tags';
import {
  isDashboardKpiFresh,
  readDashboardKpiSnapshot,
  writeDashboardKpiSnapshot,
} from '@/lib/dashboard-kpi-snapshot';
import { getMonthJarExchangeKpis } from '@/lib/jar-exchange/stats';
import {
  dashboardSalesOrderWhere,
  revenueEligibleOrderWhere,
} from '@/lib/jar-exchange/revenue';
import {
  defaultTaipeiMonthRange,
  taipeiDateInput,
  taipeiDateKeysLastNDays,
  taipeiStartOfLastNDays,
  taipeiTodayRange,
  taipeiWeekRangeSunday,
} from '@/lib/taipei-date';

const ORDER_SOURCES = ['website', 'line', 'consignment', 'subscription', 'manual', 'jar_exchange'] as const;

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;

/** Supabase pooler 連線有限；並行查詢，不再每筆包 withDbRetry（避免巢狀重試拖到 10s） */
async function runInBatches(
  tasks: (() => Promise<unknown>)[],
  batchSize = 6,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize);
    results.push(...(await Promise.all(chunk.map((fn) => fn()))));
  }
  return results;
}

const loadDashboardDataCached = unstable_cache(
  () => loadDashboardData(),
  ['dashboard-overview-v3'],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] },
);

/** cron／手動：重算並寫入預聚合快照 */
export async function refreshDashboardKpiSnapshot(): Promise<DashboardData> {
  const data = await withDbRetry(() => loadDashboardData());
  await writeDashboardKpiSnapshot(data);
  const { bustCacheTags } = await import('@/lib/runtime-cache');
  await bustCacheTags(CACHE_TAGS.dashboard);
  return data;
}

export async function getDashboardData(): Promise<DashboardData> {
  return withDbRetry(async () => {
    const snap = await readDashboardKpiSnapshot();
    if (snap && isDashboardKpiFresh(snap.computedAt)) {
      return snap.payload as DashboardData;
    }

    const data = await loadDashboardDataCached();
    // 背景寫入快照，不擋回應
    void writeDashboardKpiSnapshot(data);
    return data;
  });
}

async function loadDashboardData() {
  const { start: startOfDay, end: endOfDay } = taipeiTodayRange();
  const { start: startOfMonth } = defaultTaipeiMonthRange();
  const { start: startOfWeek, end: endOfWeek } = taipeiWeekRangeSunday();
  const last30Keys = taipeiDateKeysLastNDays(30);
  const last30 = taipeiStartOfLastNDays(30);

  const [
    todayOrderCount,
    monthRevenueAgg,
    products,
    merchantsCount,
    pendingSettlement,
    newCustomersThisMonth,
    activeSubscriptionsCount,
    weekShipments,
    last30Orders,
    sourceBreakdown,
    topProductsRaw,
    topMerchantsRaw,
    lowStockBalances,
    jarKpis,
  ] = (await runInBatches([
    // 順序必須與上方解構變數一致
    () =>
      prisma.order.count({
        where: {
          orderedAt: { gte: startOfDay, lte: endOfDay },
          ...dashboardSalesOrderWhere,
        },
      }),
    () =>
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          orderedAt: { gte: startOfMonth },
          ...revenueEligibleOrderWhere,
        },
      }),
    () =>
      prisma.product.findMany({
        select: {
          id: true,
          productId: true,
          name: true,
          reorderPoint: true,
          sku: true,
          cost: true,
        },
      }),
    () => prisma.merchant.count(),
    () =>
      prisma.settlement.aggregate({
        _sum: { payable: true },
        where: { status: { in: ['draft', 'reviewing', 'approved'] } },
      }),
    () =>
      prisma.customer.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    () => prisma.subscription.count({ where: { status: 'active' } }),
    () =>
      prisma.subscriptionShipment.findMany({
        where: {
          scheduledDate: { gte: startOfWeek, lt: endOfWeek },
          status: { in: ['pending', 'packed'] },
        },
        include: {
          subscription: {
            include: { customer: true, plan: true },
          },
        },
        orderBy: { scheduledDate: 'asc' },
      }),
    () =>
      prisma.order.findMany({
        where: {
          orderedAt: { gte: last30 },
          ...revenueEligibleOrderWhere,
        },
        select: { orderedAt: true, total: true, source: true },
      }),
    () =>
      prisma.order.groupBy({
        by: ['source'],
        _sum: { total: true },
        _count: { _all: true },
        where: {
          orderedAt: { gte: startOfMonth },
          ...revenueEligibleOrderWhere,
        },
      }),
    () =>
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        _sum: { quantity: true, subtotal: true },
        where: {
          order: {
            orderedAt: { gte: last30 },
            ...revenueEligibleOrderWhere,
          },
        },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 10,
      }),
    () =>
      prisma.order.groupBy({
        by: ['merchantId'],
        _sum: { total: true },
        _count: { _all: true },
        where: {
          merchantId: { not: null },
          orderedAt: { gte: last30 },
          ...revenueEligibleOrderWhere,
        },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    () =>
      prisma.inventoryBalance.findMany({
        include: { product: true, warehouse: true },
      }),
    () => getMonthJarExchangeKpis(),
  ])) as [
    number,
    { _sum: { total: number | null } },
    {
      id: string;
      productId: string;
      name: string;
      reorderPoint: number;
      sku: string;
      cost: number;
    }[],
    number,
    { _sum: { payable: number | null } },
    number,
    number,
    Awaited<
      ReturnType<
        typeof prisma.subscriptionShipment.findMany<{
          include: {
            subscription: { include: { customer: true; plan: true } };
          };
        }>
      >
    >,
    { orderedAt: Date; total: number; source: string }[],
    { source: string; _sum: { total: number | null }; _count: { _all: number } }[],
    {
      productId: string;
      productName: string;
      _sum: { quantity: number | null; subtotal: number | null };
    }[],
    {
      merchantId: string | null;
      _sum: { total: number | null };
      _count: { _all: number };
    }[],
    Awaited<
      ReturnType<
        typeof prisma.inventoryBalance.findMany<{
          include: { product: true; warehouse: true };
        }>
      >
    >,
    Awaited<ReturnType<typeof getMonthJarExchangeKpis>>,
  ];

  // 庫存總值 + 低庫存（與下方表格一致：僅主倉 WH-MAIN）
  const productMap = new Map(products.map((p) => [p.id, p]));
  let inventoryValue = 0;
  const mainWarehouseTotals = new Map<string, number>();
  for (const b of lowStockBalances) {
    const unitCost = Number(
      b.product?.cost ?? productMap.get(b.productId)?.cost ?? 0,
    );
    inventoryValue += b.quantity * unitCost;
    if (b.warehouse?.code === 'WH-MAIN') {
      mainWarehouseTotals.set(
        b.productId,
        (mainWarehouseTotals.get(b.productId) ?? 0) + b.quantity,
      );
    }
  }
  const lowStockProducts = products
    .map((p) => ({
      ...p,
      onHand: mainWarehouseTotals.get(p.id) ?? 0,
    }))
    .filter((p) => p.onHand <= p.reorderPoint)
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, 8);

  // 30 天營收趨勢（台北日曆日）
  const dayMap = new Map<string, number>();
  for (const key of last30Keys) {
    dayMap.set(key, 0);
  }
  for (const o of last30Orders) {
    const key = taipeiDateInput(o.orderedAt);
    if (!dayMap.has(key)) continue;
    dayMap.set(key, (dayMap.get(key) ?? 0) + Number(o.total));
  }
  const revenueTrend = Array.from(dayMap.entries()).map(([date, total]) => ({
    date,
    total,
  }));

  // 訂單來源分布
  const sourceData = ORDER_SOURCES.map((src) => {
    const row = sourceBreakdown.find((b) => b.source === src);
    return {
      source: src as string,
      total: Number(row?._sum.total ?? 0),
      count: row?._count._all ?? 0,
    };
  });

  const topProducts = topProductsRaw.map((p) => {
    const meta = productMap.get(p.productId);
    return {
      productId: meta?.productId ?? '',
      sku: meta?.sku ?? '',
      name: p.productName,
      quantity: p._sum.quantity ?? 0,
      subtotal: Number(p._sum.subtotal ?? 0),
    };
  });

  // 寄賣店銷售排行 + 本月回購基數並行
  const merchantIds = topMerchantsRaw
    .map((m) => m.merchantId)
    .filter((id): id is string => Boolean(id));

  const [merchants, monthCustomers] = await Promise.all([
    merchantIds.length
      ? prisma.merchant.findMany({ where: { id: { in: merchantIds } } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.merchant.findMany>>),
    prisma.order.findMany({
      where: {
        orderedAt: { gte: startOfMonth },
        customerId: { not: null },
        ...dashboardSalesOrderWhere,
      },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
  ]);
  const merchantMap = new Map(merchants.map((m) => [m.id, m]));
  const topMerchants = topMerchantsRaw.map((row) => {
    const m = merchantMap.get(row.merchantId!);
    return {
      merchantId: m?.merchantId ?? '',
      name: m?.name ?? '未知',
      total: Number(row._sum.total ?? 0),
      orders: row._count._all,
    };
  });

  // 本月回購率：本月有銷售下單 且 之前也有過銷售下單 / 本月有下單會員
  const customerIdsThisMonth = monthCustomers.map((c) => c.customerId!).filter(Boolean);
  let repurchaseRate = 0;
  if (customerIdsThisMonth.length) {
    const repurchased = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIdsThisMonth },
        orderedAt: { lt: startOfMonth },
        ...dashboardSalesOrderWhere,
      },
    });
    repurchaseRate = repurchased.length / customerIdsThisMonth.length;
  }

  // 轉成純 JSON（Date→ISO、Decimal→number），避免 Data Cache／RSC 序列化炸掉
  const lowStockPlain = lowStockBalances
    .filter(
      (b) =>
        b.product != null &&
        b.warehouse?.code === 'WH-MAIN' &&
        b.quantity <= b.product.reorderPoint,
    )
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      quantity: b.quantity,
      product: b.product
        ? {
            name: b.product.name,
            productId: b.product.productId,
            sku: b.product.sku,
            reorderPoint: b.product.reorderPoint,
          }
        : null,
    }));

  const weekShipmentsPlain = weekShipments.map((sh) => ({
    id: sh.id,
    status: sh.status,
    scheduledDate: sh.scheduledDate.toISOString(),
    subscription: {
      recipientPhone: sh.subscription.recipientPhone,
      shippingAddress: sh.subscription.shippingAddress,
      customer: {
        id: sh.subscription.customer.id,
        name: sh.subscription.customer.name,
        customerId: sh.subscription.customer.customerId,
      },
      plan: { name: sh.subscription.plan.name },
    },
  }));

  return {
    kpis: {
      todayOrderCount,
      monthRevenue: Number(monthRevenueAgg._sum.total ?? 0),
      inventoryValue,
      lowStockCount: lowStockProducts.length,
      merchantsCount,
      pendingSettlementAmount: Number(pendingSettlement._sum.payable ?? 0),
      activeSubscriptionsCount,
      repurchaseRate,
      newCustomersThisMonth,
      monthJarPointsIssued: jarKpis.monthJarPointsIssued,
      monthGroomingCouponCost: jarKpis.monthGroomingCouponCost,
      weekJarPointsEarnedMemberCount: jarKpis.weekJarPointsEarnedMemberCount,
      weekJarPointsRedeemedMemberCount: jarKpis.weekJarPointsRedeemedMemberCount,
      weekJarRedeemCount: jarKpis.weekJarRedeemCount,
    },
    revenueTrend,
    sourceData,
    topProducts,
    topMerchants,
    lowStockBalances: lowStockPlain,
    weekShipments: weekShipmentsPlain,
  };
}
