import { unstable_cache } from 'next/cache';
import { Prisma } from '@prisma/client';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { getMerchantIndustryMap } from '@/lib/merchant-industry-persist';
import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import type { MerchantType } from '@/lib/merchant-types';
import { prisma } from '@/lib/prisma';
import { withRuntimeCache } from '@/lib/runtime-cache';
import { defaultPeriod } from '@/lib/settlement-calc';

export type MerchantReportPeriod = 'week' | 'month';

export function resolveMerchantReportPeriod(
  period: MerchantReportPeriod,
  today = new Date(),
): { start: Date; end: Date } {
  if (period === 'month') {
    return defaultPeriod(today);
  }

  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export type MerchantPortfolioRow = {
  id: string;
  merchantId: string;
  name: string;
  type: string;
  types: MerchantType[];
  industry: string | null;
  city: string | null;
  phone: string | null;
  commissionRate: number;
  orderCount: number;
  settlementCount: number;
  stockUnits: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  periodSoldQty: number;
  periodGrossSales: number;
  periodCommission: number;
  periodCompanyRevenue: number;
  periodRestockQty: number;
};

export type MerchantPortfolioTopProduct = {
  productInternalId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  grossSales: number;
};

export type MerchantsPortfolioReport = {
  periodStart: Date;
  periodEnd: Date;
  totals: {
    soldQty: number;
    grossSales: number;
    commissionAmount: number;
    companyRevenue: number;
    totalStock: number;
    restockQty: number;
    merchantCount: number;
    lowStockSkus: number;
    outOfStockSkus: number;
    inTransitShipments: number;
    openSettlements: number;
  };
  merchants: MerchantPortfolioRow[];
  topProducts: MerchantPortfolioTopProduct[];
};

export async function loadMerchantsPortfolioReport(
  periodStart: Date,
  periodEnd: Date,
  options?: { merchantIds?: string[] },
): Promise<MerchantsPortfolioReport> {
  const merchantIdsKey = options?.merchantIds?.slice().sort().join(',') ?? 'all';
  const cacheKey = [
    'merchants-portfolio-v1',
    periodStart.toISOString(),
    periodEnd.toISOString(),
    merchantIdsKey,
  ].join(':');

  return withRuntimeCache(
    cacheKey,
    {
      ttlSeconds: 60,
      tags: [CACHE_TAGS.merchantsPortfolio],
      name: 'merchants-portfolio',
    },
    () => {
      const cached = unstable_cache(
        () =>
          loadMerchantsPortfolioReportUncached(
            periodStart,
            periodEnd,
            options?.merchantIds,
          ),
        [
          'merchants-portfolio-v1',
          periodStart.toISOString(),
          periodEnd.toISOString(),
          merchantIdsKey,
        ],
        { revalidate: 60, tags: [CACHE_TAGS.merchantsPortfolio] },
      );
      return cached();
    },
  );
}

async function loadMerchantsPortfolioReportUncached(
  periodStart: Date,
  periodEnd: Date,
  merchantIds?: string[],
): Promise<MerchantsPortfolioReport> {
  const merchantWhere = merchantIds?.length ? { id: { in: merchantIds } } : undefined;
  const merchantIdFilter =
    merchantIds && merchantIds.length > 0
      ? Prisma.sql`AND "merchantId" IN (${Prisma.join(merchantIds)})`
      : Prisma.empty;

  const [
    merchants,
    stocks,
    saleAgg,
    topProductAgg,
    restockAgg,
    inTransitShipments,
    openSettlements,
  ] = await Promise.all([
    prisma.merchant.findMany({
      where: merchantWhere,
      select: {
        id: true,
        merchantId: true,
        name: true,
        type: true,
        city: true,
        phone: true,
        commissionRate: true,
        _count: { select: { orders: true, settlements: true } },
      },
      orderBy: { merchantId: 'asc' },
    }),
    prisma.merchantStock.findMany({
      where: merchantIds?.length ? { merchantId: { in: merchantIds } } : undefined,
      select: { merchantId: true, quantity: true },
    }),
    prisma.$queryRaw<
      {
        merchantId: string;
        soldQty: number;
        grossSales: number;
        commission: number;
        companyRevenue: number;
      }[]
    >`
      SELECT
        "merchantId",
        SUM(ABS("quantity"))::float AS "soldQty",
        SUM(ABS("quantity") * COALESCE("unitPrice", 0))::float AS "grossSales",
        SUM(COALESCE("commissionAmount", 0))::float AS "commission",
        SUM(COALESCE("companyRevenue", 0))::float AS "companyRevenue"
      FROM "MerchantStockTxn"
      WHERE "type" = 'sale'
        AND "createdAt" >= ${periodStart}
        AND "createdAt" <= ${periodEnd}
        ${merchantIdFilter}
      GROUP BY "merchantId"
    `,
    prisma.$queryRaw<{ productId: string; quantity: number; grossSales: number }[]>`
      SELECT
        "productId",
        SUM(ABS("quantity"))::float AS "quantity",
        SUM(ABS("quantity") * COALESCE("unitPrice", 0))::float AS "grossSales"
      FROM "MerchantStockTxn"
      WHERE "type" = 'sale'
        AND "createdAt" >= ${periodStart}
        AND "createdAt" <= ${periodEnd}
        ${merchantIdFilter}
      GROUP BY "productId"
      ORDER BY SUM(ABS("quantity")) DESC
      LIMIT 8
    `,
    prisma.merchantStockTxn.groupBy({
      by: ['merchantId'],
      where: {
        type: 'restock',
        createdAt: { gte: periodStart, lte: periodEnd },
        ...(merchantIds?.length ? { merchantId: { in: merchantIds } } : {}),
      },
      _sum: { quantity: true },
    }),
    prisma.shipment.count({
      where: { status: { in: ['pending', 'packed', 'shipped'] } },
    }),
    prisma.settlement.count({
      where: { status: { in: ['draft', 'reviewing'] } },
    }),
  ]);

  const stockByMerchant = new Map<string, { total: number; low: number; out: number }>();
  for (const stock of stocks) {
    const row = stockByMerchant.get(stock.merchantId) ?? { total: 0, low: 0, out: 0 };
    row.total += stock.quantity;
    if (stock.quantity === 0) row.out += 1;
    else if (stock.quantity <= 3) row.low += 1;
    stockByMerchant.set(stock.merchantId, row);
  }

  const salesByMerchant = new Map(
    saleAgg.map((row) => [
      row.merchantId,
      {
        soldQty: Number(row.soldQty ?? 0),
        grossSales: Number(row.grossSales ?? 0),
        commission: Number(row.commission ?? 0),
        companyRevenue: Number(row.companyRevenue ?? 0),
      },
    ]),
  );

  const restockByMerchant = new Map(
    restockAgg.map((row) => [row.merchantId, row._sum.quantity ?? 0]),
  );

  const topProductIds = topProductAgg.map((row) => row.productId);
  const topProductMeta = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, productId: true, name: true, sku: true },
      })
    : [];
  const topProductMetaMap = new Map(topProductMeta.map((p) => [p.id, p]));
  const topProducts: MerchantPortfolioTopProduct[] = topProductAgg.map((row) => {
    const meta = topProductMetaMap.get(row.productId);
    return {
      productInternalId: row.productId,
      productId: meta?.productId ?? '',
      productName: meta?.name ?? '未知商品',
      sku: meta?.sku ?? '',
      quantity: Number(row.quantity ?? 0),
      grossSales: Number(row.grossSales ?? 0),
    };
  });

  const [industryByMerchant, typesByMerchant] = await Promise.all([
    getMerchantIndustryMap(
      prisma,
      merchants.map((m) => m.id),
    ),
    getMerchantTypesMap(
      prisma,
      merchants.map((m) => ({ id: m.id, type: m.type })),
    ),
  ]);

  const merchantRows: MerchantPortfolioRow[] = merchants.map((merchant) => {
    const stock = stockByMerchant.get(merchant.id) ?? { total: 0, low: 0, out: 0 };
    const sales = salesByMerchant.get(merchant.id) ?? {
      soldQty: 0,
      grossSales: 0,
      commission: 0,
      companyRevenue: 0,
    };

    return {
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      type: merchant.type,
      types: typesByMerchant.get(merchant.id) ?? ['consignment'],
      industry: industryByMerchant.get(merchant.id) ?? null,
      city: merchant.city,
      phone: merchant.phone,
      commissionRate: Number(merchant.commissionRate),
      orderCount: merchant._count.orders,
      settlementCount: merchant._count.settlements,
      stockUnits: stock.total,
      lowStockSkus: stock.low,
      outOfStockSkus: stock.out,
      periodSoldQty: sales.soldQty,
      periodGrossSales: sales.grossSales,
      periodCommission: sales.commission,
      periodCompanyRevenue: sales.companyRevenue,
      periodRestockQty: restockByMerchant.get(merchant.id) ?? 0,
    };
  });

  const totals = merchantRows.reduce(
    (acc, row) => {
      acc.soldQty += row.periodSoldQty;
      acc.grossSales += row.periodGrossSales;
      acc.commissionAmount += row.periodCommission;
      acc.companyRevenue += row.periodCompanyRevenue;
      acc.totalStock += row.stockUnits;
      acc.restockQty += row.periodRestockQty;
      acc.lowStockSkus += row.lowStockSkus;
      acc.outOfStockSkus += row.outOfStockSkus;
      return acc;
    },
    {
      soldQty: 0,
      grossSales: 0,
      commissionAmount: 0,
      companyRevenue: 0,
      totalStock: 0,
      restockQty: 0,
      merchantCount: merchantRows.length,
      lowStockSkus: 0,
      outOfStockSkus: 0,
      inTransitShipments,
      openSettlements,
    },
  );

  return {
    periodStart,
    periodEnd,
    totals,
    merchants: merchantRows,
    topProducts,
  };
}
