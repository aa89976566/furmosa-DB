import { prisma } from '@/lib/prisma';

const ORDER_SOURCES = ['website', 'line', 'consignment', 'subscription', 'manual'] as const;

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 29);

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [
    todayOrderCount,
    monthRevenueAgg,
    inventoryValueRows,
    products,
    merchantsCount,
    pendingSettlement,
    membersCount,
    activeSubscriptionsCount,
    weekShipments,
    last30Orders,
    sourceBreakdown,
    topProductsRaw,
    topMerchantsRaw,
    lowStockBalances,
    pendingTasks,
  ] = await Promise.all([
    prisma.order.count({
      where: { orderedAt: { gte: startOfDay }, status: { not: 'cancelled' } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { orderedAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
    }),
    prisma.inventoryBalance.findMany({
      include: { product: { select: { cost: true } } },
    }),
    prisma.product.findMany({
      select: { id: true, productId: true, name: true, reorderPoint: true, sku: true },
    }),
    prisma.merchant.count(),
    prisma.settlement.aggregate({
      _sum: { payable: true },
      where: { status: { in: ['draft', 'reviewing', 'approved'] } },
    }),
    prisma.customer.count({ where: { isLoyaltyMember: true } }),
    prisma.subscription.count({ where: { status: 'active' } }),
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
    prisma.order.findMany({
      where: { orderedAt: { gte: last30 }, status: { not: 'cancelled' } },
      select: { orderedAt: true, total: true, source: true },
    }),
    prisma.order.groupBy({
      by: ['source'],
      _sum: { total: true },
      _count: { _all: true },
      where: { orderedAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true, subtotal: true },
      where: {
        order: {
          orderedAt: { gte: last30 },
          status: { not: 'cancelled' },
        },
      },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ['merchantId'],
      _sum: { total: true },
      _count: { _all: true },
      where: {
        merchantId: { not: null },
        orderedAt: { gte: last30 },
        status: { not: 'cancelled' },
      },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    prisma.inventoryBalance.findMany({
      include: { product: true, warehouse: true },
    }),
    prisma.task.findMany({
      where: { status: { in: ['todo', 'in_progress', 'blocked'] } },
      include: { assignee: true },
      orderBy: { dueDate: 'asc' },
      take: 6,
    }),
  ]);

  // 庫存總值 + 低庫存
  const productMap = new Map(products.map((p) => [p.id, p]));
  let inventoryValue = 0;
  const productTotals = new Map<string, number>();
  for (const b of inventoryValueRows) {
    inventoryValue += b.quantity * Number(b.product.cost);
    productTotals.set(b.productId, (productTotals.get(b.productId) ?? 0) + b.quantity);
  }
  const lowStockProducts = products
    .map((p) => ({
      ...p,
      onHand: productTotals.get(p.id) ?? 0,
    }))
    .filter((p) => p.onHand <= p.reorderPoint)
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, 8);

  // 30 天營收趨勢
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }
  for (const o of last30Orders) {
    const key = o.orderedAt.toISOString().slice(0, 10);
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

  // 寄賣店銷售排行
  const merchants = await prisma.merchant.findMany({
    where: { id: { in: topMerchantsRaw.map((m) => m.merchantId!).filter(Boolean) } },
  });
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

  // 本月回購率：本月有下單 且 之前也有過下單 / 本月有下單會員
  const monthCustomers = await prisma.order.findMany({
    where: { orderedAt: { gte: startOfMonth }, customerId: { not: null } },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const customerIdsThisMonth = monthCustomers.map((c) => c.customerId!).filter(Boolean);
  let repurchaseRate = 0;
  if (customerIdsThisMonth.length) {
    const repurchased = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIdsThisMonth },
        orderedAt: { lt: startOfMonth },
      },
    });
    repurchaseRate = repurchased.length / customerIdsThisMonth.length;
  }

  return {
    kpis: {
      todayOrderCount,
      monthRevenue: Number(monthRevenueAgg._sum.total ?? 0),
      inventoryValue,
      lowStockCount: lowStockProducts.length,
      merchantsCount,
      pendingSettlementAmount: Number(pendingSettlement._sum.payable ?? 0),
      membersCount,
      activeSubscriptionsCount,
      repurchaseRate,
    },
    revenueTrend,
    sourceData,
    topProducts,
    topMerchants,
    lowStockBalances: lowStockBalances
      .filter((b) => b.quantity <= b.product.reorderPoint && b.warehouse.code === 'WH-MAIN')
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8),
    pendingTasks,
    weekShipments,
  };
}
