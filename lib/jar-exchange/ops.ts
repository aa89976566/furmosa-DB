import { prisma } from '@/lib/prisma';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import { getMonthJarExchangeKpis } from '@/lib/jar-exchange/stats';
import { taipeiWeekRangeSunday } from '@/lib/taipei-date';

/** 庫存緊張／缺貨門檻 */
export const JAR_OPS_LOW_STOCK_THRESHOLD = 3;

/** 一鍵補貨目標在店數量 */
export const JAR_OPS_TARGET_STOCK = 6;

export type JarOpsProductCol = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

export type JarOpsStockCell = {
  productId: string;
  quantity: number;
  status: 'ok' | 'low' | 'out';
  suggestedRestockQty: number;
};

export type JarOpsMerchantRow = {
  id: string;
  merchantId: string;
  name: string;
  city: string | null;
  cells: JarOpsStockCell[];
  lowOrOutCount: number;
  inTransitCount: number;
  totalSuggestedQty: number;
};

export type JarOpsStatus = {
  weekJarRedeemCount: number;
  weekCouponRedeemCount: number;
  monthJarPointsIssued: number;
  monthGroomingCouponCost: number;
  unusedJarCodeCount: number;
  lowStockCellCount: number;
  outOfStockCellCount: number;
  inTransitRestockCount: number;
  merchantCount: number;
  productCount: number;
};

export type JarOpsConsoleData = {
  status: JarOpsStatus;
  products: JarOpsProductCol[];
  merchants: JarOpsMerchantRow[];
};

export function stockCellStatus(quantity: number): JarOpsStockCell['status'] {
  if (quantity <= 0) return 'out';
  if (quantity <= JAR_OPS_LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

export function suggestedRestockQty(
  quantity: number,
  target = JAR_OPS_TARGET_STOCK,
  lowThreshold = JAR_OPS_LOW_STOCK_THRESHOLD,
): number {
  if (quantity > lowThreshold) return 0;
  return Math.max(0, target - quantity);
}

async function listJarExchangeProducts(): Promise<JarOpsProductCol[]> {
  return prisma.product.findMany({
    where: {
      status: 'active',
      productCategory: 'JAR_EXCHANGE',
    },
    select: { id: true, name: true, sku: true, unit: true },
    orderBy: { name: 'asc' },
  });
}

export async function getJarOpsConsoleData(): Promise<JarOpsConsoleData> {
  const [merchants, products, monthKpis] = await Promise.all([
    listJarExchangeMerchants(),
    listJarExchangeProducts(),
    getMonthJarExchangeKpis(),
  ]);

  const merchantIds = merchants.map((m) => m.id);
  const productIds = products.map((p) => p.id);
  const productIdSet = new Set(productIds);
  const { start: startOfWeek } = taipeiWeekRangeSunday();

  const [stocks, inTransitShipments, unusedJarCodeCount, weekCouponRedeemCount] =
    await Promise.all([
      productIds.length === 0 || merchantIds.length === 0
        ? Promise.resolve([])
        : prisma.merchantStock.findMany({
            where: {
              merchantId: { in: merchantIds },
              productId: { in: productIds },
            },
            select: { merchantId: true, productId: true, quantity: true },
          }),
      merchantIds.length === 0
        ? Promise.resolve([])
        : prisma.shipment.findMany({
            where: {
              merchantId: { in: merchantIds },
              type: 'merchant_restock',
              status: { in: ['pending', 'packed', 'shipped'] },
            },
            select: {
              merchantId: true,
              items: { select: { productId: true } },
            },
          }),
      prisma.jarCode.count({ where: { status: 'unused' } }),
      prisma.groomingCoupon.count({
        where: {
          status: 'redeemed',
          redeemedAt: { gte: startOfWeek },
        },
      }),
    ]);

  const qtyMap = new Map<string, number>();
  for (const row of stocks) {
    const key = `${row.merchantId}:${row.productId}`;
    qtyMap.set(key, (qtyMap.get(key) ?? 0) + row.quantity);
  }

  const inTransitByMerchant = new Map<string, number>();
  let inTransitRestockCount = 0;
  for (const shipment of inTransitShipments) {
    if (!shipment.merchantId) continue;
    const jarItems = shipment.items.filter((it) => productIdSet.has(it.productId));
    if (productIds.length > 0 && jarItems.length === 0) continue;
    inTransitRestockCount += 1;
    inTransitByMerchant.set(
      shipment.merchantId,
      (inTransitByMerchant.get(shipment.merchantId) ?? 0) + 1,
    );
  }

  let lowStockCellCount = 0;
  let outOfStockCellCount = 0;

  const merchantRows: JarOpsMerchantRow[] = merchants.map((merchant) => {
    const cells: JarOpsStockCell[] = products.map((product) => {
      const quantity = qtyMap.get(`${merchant.id}:${product.id}`) ?? 0;
      const status = stockCellStatus(quantity);
      const suggested = suggestedRestockQty(quantity);
      if (status === 'out') outOfStockCellCount += 1;
      if (status === 'low' || status === 'out') lowStockCellCount += 1;
      return {
        productId: product.id,
        quantity,
        status,
        suggestedRestockQty: suggested,
      };
    });

    return {
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      city: merchant.city,
      cells,
      lowOrOutCount: cells.filter((c) => c.status !== 'ok').length,
      inTransitCount: inTransitByMerchant.get(merchant.id) ?? 0,
      totalSuggestedQty: cells.reduce((sum, c) => sum + c.suggestedRestockQty, 0),
    };
  });

  return {
    status: {
      weekJarRedeemCount: monthKpis.weekJarRedeemCount,
      weekCouponRedeemCount,
      monthJarPointsIssued: monthKpis.monthJarPointsIssued,
      monthGroomingCouponCost: monthKpis.monthGroomingCouponCost,
      unusedJarCodeCount,
      lowStockCellCount,
      outOfStockCellCount,
      inTransitRestockCount,
      merchantCount: merchants.length,
      productCount: products.length,
    },
    products,
    merchants: merchantRows,
  };
}
