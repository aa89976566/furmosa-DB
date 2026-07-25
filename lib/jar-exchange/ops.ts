import { prisma } from '@/lib/prisma';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import { getMonthJarExchangeKpis } from '@/lib/jar-exchange/stats';
import { taipeiWeekRangeSunday } from '@/lib/taipei-date';

/** 庫存緊張門檻（與寄賣詳情頁一致） */
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
  status: 'ok' | 'low' | 'out' | 'negative';
  suggestedRestockQty: number;
};

export type JarOpsMerchantRow = {
  id: string;
  merchantId: string;
  name: string;
  city: string | null;
  hasShippingProfile: boolean;
  cells: JarOpsStockCell[];
  lowOrOutCount: number;
  negativeCount: number;
  inTransitCount: number;
  totalSuggestedQty: number;
};

export type JarOpsStatus = {
  weekJarRedeemCount: number;
  weekCouponRedeemCount: number;
  weekJarPointsEarnedMemberCount: number;
  weekJarPointsRedeemedMemberCount: number;
  monthJarPointsIssued: number;
  monthGroomingCouponCost: number;
  unusedJarCodeCount: number;
  lowStockCellCount: number;
  outOfStockCellCount: number;
  negativeStockCellCount: number;
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
  if (quantity < 0) return 'negative';
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

export function merchantHasShippingProfile(m: {
  preferredCarrier: string | null;
  pickupStoreName: string | null;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  name: string;
}): boolean {
  const phone = (m.phone ?? '').trim();
  const name = (m.contactName ?? m.name ?? '').trim();
  if (!phone || !name) return false;
  const carrier = (m.preferredCarrier ?? '').trim();
  if (carrier === '7-11') {
    return Boolean((m.pickupStoreName ?? '').trim());
  }
  return Boolean((m.address ?? '').trim());
}

async function listJarExchangeProducts(): Promise<JarOpsProductCol[]> {
  return prisma.product.findMany({
    where: { status: 'active', productCategory: 'JAR_EXCHANGE' },
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
  const { start: startOfWeek } = taipeiWeekRangeSunday();

  const [stocks, inTransitShipments, unusedJarCodeCount, weekCouponRedeemCount, merchantProfiles] =
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
            select: { merchantId: true },
          }),
      prisma.jarCode.count({ where: { status: 'unused' } }),
      prisma.groomingCoupon.count({
        where: {
          status: 'redeemed',
          redeemedAt: { gte: startOfWeek },
        },
      }),
      merchantIds.length === 0
        ? Promise.resolve([])
        : prisma.merchant.findMany({
            where: { id: { in: merchantIds } },
            select: {
              id: true,
              name: true,
              contactName: true,
              phone: true,
              address: true,
              preferredCarrier: true,
              pickupStoreName: true,
            },
          }),
    ]);

  const profileMap = new Map(merchantProfiles.map((m) => [m.id, m]));

  const qtyMap = new Map<string, number>();
  for (const row of stocks) {
    const key = `${row.merchantId}:${row.productId}`;
    qtyMap.set(key, (qtyMap.get(key) ?? 0) + row.quantity);
  }

  const inTransitByMerchant = new Map<string, number>();
  for (const shipment of inTransitShipments) {
    if (!shipment.merchantId) continue;
    inTransitByMerchant.set(
      shipment.merchantId,
      (inTransitByMerchant.get(shipment.merchantId) ?? 0) + 1,
    );
  }

  let lowStockCellCount = 0;
  let outOfStockCellCount = 0;
  let negativeStockCellCount = 0;

  const merchantRows: JarOpsMerchantRow[] = merchants.map((merchant) => {
    const profile = profileMap.get(merchant.id);
    const cells: JarOpsStockCell[] = products.map((product) => {
      const quantity = qtyMap.get(`${merchant.id}:${product.id}`) ?? 0;
      const status = stockCellStatus(quantity);
      const suggested = suggestedRestockQty(quantity);
      if (status === 'negative') negativeStockCellCount += 1;
      if (status === 'out') outOfStockCellCount += 1;
      if (status === 'low' || status === 'out' || status === 'negative') {
        lowStockCellCount += 1;
      }
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
      hasShippingProfile: profile
        ? merchantHasShippingProfile(profile)
        : false,
      cells,
      lowOrOutCount: cells.filter((c) => c.status !== 'ok').length,
      negativeCount: cells.filter((c) => c.status === 'negative').length,
      inTransitCount: inTransitByMerchant.get(merchant.id) ?? 0,
      totalSuggestedQty: cells.reduce((sum, c) => sum + c.suggestedRestockQty, 0),
    };
  });

  return {
    status: {
      weekJarRedeemCount: monthKpis.weekJarRedeemCount,
      weekCouponRedeemCount,
      weekJarPointsEarnedMemberCount: monthKpis.weekJarPointsEarnedMemberCount,
      weekJarPointsRedeemedMemberCount: monthKpis.weekJarPointsRedeemedMemberCount,
      monthJarPointsIssued: monthKpis.monthJarPointsIssued,
      monthGroomingCouponCost: monthKpis.monthGroomingCouponCost,
      unusedJarCodeCount,
      lowStockCellCount,
      outOfStockCellCount,
      negativeStockCellCount,
      inTransitRestockCount: inTransitShipments.length,
      merchantCount: merchants.length,
      productCount: products.length,
    },
    products,
    merchants: merchantRows,
  };
}

/** Dashboard 換罐區摘要 */
export async function getJarOpsDashboardSummary() {
  const data = await getJarOpsConsoleData();
  return {
    weekJarRedeemCount: data.status.weekJarRedeemCount,
    weekJarPointsEarnedMemberCount: data.status.weekJarPointsEarnedMemberCount,
    weekJarPointsRedeemedMemberCount: data.status.weekJarPointsRedeemedMemberCount,
    monthJarPointsIssued: data.status.monthJarPointsIssued,
    monthGroomingCouponCost: data.status.monthGroomingCouponCost,
    lowStockCellCount: data.status.lowStockCellCount,
    outOfStockCellCount: data.status.outOfStockCellCount,
    negativeStockCellCount: data.status.negativeStockCellCount,
    inTransitRestockCount: data.status.inTransitRestockCount,
    unusedJarCodeCount: data.status.unusedJarCodeCount,
  };
}
