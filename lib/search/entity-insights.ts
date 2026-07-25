import { prisma } from '@/lib/prisma';
import { activeOrderWhere } from '@/lib/order-list';

export type MerchantSearchInsight = {
  stockUnits: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  lastRestockAt: string | null;
  restockTxnCount90d: number;
  /** 換罐計畫 SKU（productCategory = JAR_EXCHANGE）在店庫存 */
  jarStockUnits: number;
  jarLowStockSkus: number;
  jarOutOfStockSkus: number;
};

export type CustomerTopProduct = {
  productId: string;
  productName: string;
  quantity: number;
  orderCount: number;
};

export type CustomerSearchInsight = {
  orderCount: number;
  lastOrderAt: string | null;
  topProducts: CustomerTopProduct[];
  /** 換罐點數餘額（帳本最新 balanceAfter） */
  jarPointsBalance: number;
  /** 已兌換序號數 */
  jarCodesRedeemed: number;
  lastJarRedeemAt: string | null;
};

const MS_90D = 90 * 24 * 60 * 60 * 1000;

/** 批次載入寄賣店搜尋洞察（庫存／叫貨）— 僅給已命中的少量 id */
export async function loadMerchantSearchInsights(
  merchantIds: string[],
): Promise<Map<string, MerchantSearchInsight>> {
  const map = new Map<string, MerchantSearchInsight>();
  if (merchantIds.length === 0) return map;

  const since = new Date(Date.now() - MS_90D);

  const [stocks, jarStocks, restockGroups, lastRestocks] = await Promise.all([
    prisma.merchantStock.findMany({
      where: { merchantId: { in: merchantIds } },
      select: {
        merchantId: true,
        quantity: true,
        lastRestockAt: true,
        product: { select: { reorderPoint: true } },
      },
    }),
    prisma.merchantStock.findMany({
      where: {
        merchantId: { in: merchantIds },
        product: { productCategory: 'JAR_EXCHANGE' },
      },
      select: {
        merchantId: true,
        quantity: true,
        product: { select: { reorderPoint: true } },
      },
    }),
    prisma.merchantStockTxn.groupBy({
      by: ['merchantId'],
      where: {
        merchantId: { in: merchantIds },
        type: 'restock',
        createdAt: { gte: since },
      },
      _count: { _all: true },
    }),
    prisma.merchantStockTxn.groupBy({
      by: ['merchantId'],
      where: {
        merchantId: { in: merchantIds },
        type: 'restock',
      },
      _max: { createdAt: true },
    }),
  ]);

  for (const id of merchantIds) {
    map.set(id, {
      stockUnits: 0,
      lowStockSkus: 0,
      outOfStockSkus: 0,
      lastRestockAt: null,
      restockTxnCount90d: 0,
      jarStockUnits: 0,
      jarLowStockSkus: 0,
      jarOutOfStockSkus: 0,
    });
  }

  for (const row of stocks) {
    const insight = map.get(row.merchantId);
    if (!insight) continue;
    insight.stockUnits += row.quantity;
    if (row.quantity <= 0) insight.outOfStockSkus += 1;
    else if (row.quantity <= (row.product?.reorderPoint ?? 0)) insight.lowStockSkus += 1;
  }

  for (const row of jarStocks) {
    const insight = map.get(row.merchantId);
    if (!insight) continue;
    insight.jarStockUnits += row.quantity;
    if (row.quantity <= 0) insight.jarOutOfStockSkus += 1;
    else if (row.quantity <= (row.product?.reorderPoint ?? 0)) insight.jarLowStockSkus += 1;
  }

  for (const g of restockGroups) {
    const insight = map.get(g.merchantId);
    if (insight) insight.restockTxnCount90d = g._count._all;
  }

  for (const g of lastRestocks) {
    const insight = map.get(g.merchantId);
    if (insight && g._max.createdAt) {
      insight.lastRestockAt = g._max.createdAt.toISOString();
    }
  }

  // 若流水沒有叫貨，退回 stock.lastRestockAt
  for (const row of stocks) {
    const insight = map.get(row.merchantId);
    if (!insight || insight.lastRestockAt || !row.lastRestockAt) continue;
    insight.lastRestockAt = row.lastRestockAt.toISOString();
  }

  return map;
}

/** 批次載入客戶搜尋洞察（訂單次數／常買商品） */
export async function loadCustomerSearchInsights(
  customerIds: string[],
): Promise<Map<string, CustomerSearchInsight>> {
  const map = new Map<string, CustomerSearchInsight>();
  if (customerIds.length === 0) return map;

  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  for (const id of customerIds) {
    map.set(id, {
      orderCount: 0,
      lastOrderAt: null,
      topProducts: [],
      jarPointsBalance: 0,
      jarCodesRedeemed: 0,
      lastJarRedeemAt: null,
    });
  }

  const [orderStats, items, latestLedgers, jarCodeStats] = await Promise.all([
    prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        ...activeOrderWhere,
      },
      _count: { _all: true },
      _max: { orderedAt: true },
    }),
    prisma.orderItem.findMany({
      where: {
        isGift: false,
        order: {
          customerId: { in: customerIds },
          orderedAt: { gte: since },
          ...activeOrderWhere,
        },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        order: { select: { customerId: true, id: true } },
      },
      take: 2000,
    }),
    prisma.memberPointsLedger.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['customerId'],
      select: { customerId: true, balanceAfter: true },
    }),
    prisma.jarCode.groupBy({
      by: ['redeemedByCustomerId'],
      where: {
        redeemedByCustomerId: { in: customerIds },
        status: 'used',
      },
      _count: { _all: true },
      _max: { redeemedAt: true },
    }),
  ]);

  for (const g of orderStats) {
    if (!g.customerId) continue;
    const insight = map.get(g.customerId);
    if (!insight) continue;
    insight.orderCount = g._count._all;
    insight.lastOrderAt = g._max.orderedAt ? g._max.orderedAt.toISOString() : null;
  }

  type Agg = {
    productId: string;
    productName: string;
    quantity: number;
    orderIds: Set<string>;
  };
  const byCustomer = new Map<string, Map<string, Agg>>();

  for (const item of items) {
    const customerId = item.order.customerId;
    if (!customerId) continue;
    let productMap = byCustomer.get(customerId);
    if (!productMap) {
      productMap = new Map();
      byCustomer.set(customerId, productMap);
    }
    const key = item.productId;
    let agg = productMap.get(key);
    if (!agg) {
      agg = {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        orderIds: new Set(),
      };
      productMap.set(key, agg);
    }
    agg.quantity += item.quantity;
    agg.orderIds.add(item.order.id);
  }

  for (const [customerId, productMap] of byCustomer) {
    const insight = map.get(customerId);
    if (!insight) continue;
    insight.topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity || b.orderIds.size - a.orderIds.size)
      .slice(0, 3)
      .map((a) => ({
        productId: a.productId,
        productName: a.productName,
        quantity: a.quantity,
        orderCount: a.orderIds.size,
      }));
  }

  for (const row of latestLedgers) {
    const insight = map.get(row.customerId);
    if (insight) insight.jarPointsBalance = row.balanceAfter;
  }

  for (const g of jarCodeStats) {
    if (!g.redeemedByCustomerId) continue;
    const insight = map.get(g.redeemedByCustomerId);
    if (!insight) continue;
    insight.jarCodesRedeemed = g._count._all;
    insight.lastJarRedeemAt = g._max.redeemedAt ? g._max.redeemedAt.toISOString() : null;
  }

  return map;
}
