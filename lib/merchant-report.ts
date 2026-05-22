import { prisma } from '@/lib/prisma';
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
): Promise<MerchantsPortfolioReport> {
  const [merchants, stocks, saleTxns, restockTxns, inTransitShipments, openSettlements] =
    await Promise.all([
      prisma.merchant.findMany({
        include: {
          _count: { select: { orders: true, settlements: true } },
        },
        orderBy: { merchantId: 'asc' },
      }),
      prisma.merchantStock.findMany({
        select: { merchantId: true, quantity: true },
      }),
      prisma.merchantStockTxn.findMany({
        where: {
          type: 'sale',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        include: {
          product: { select: { id: true, productId: true, name: true, sku: true } },
        },
      }),
      prisma.merchantStockTxn.findMany({
        where: {
          type: 'restock',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: { merchantId: true, quantity: true },
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

  const salesByMerchant = new Map<
    string,
    { soldQty: number; grossSales: number; commission: number; companyRevenue: number }
  >();
  const topProducts = new Map<string, MerchantPortfolioTopProduct>();

  for (const txn of saleTxns) {
    const qty = Math.abs(txn.quantity);
    const unitPrice = txn.unitPrice ?? 0;
    const lineGross = qty * unitPrice;

    const merchantSales = salesByMerchant.get(txn.merchantId) ?? {
      soldQty: 0,
      grossSales: 0,
      commission: 0,
      companyRevenue: 0,
    };
    merchantSales.soldQty += qty;
    merchantSales.grossSales += lineGross;
    merchantSales.commission += txn.commissionAmount ?? 0;
    merchantSales.companyRevenue += txn.companyRevenue ?? 0;
    salesByMerchant.set(txn.merchantId, merchantSales);

    const productRow = topProducts.get(txn.productId);
    if (productRow) {
      productRow.quantity += qty;
      productRow.grossSales += lineGross;
      continue;
    }

    topProducts.set(txn.productId, {
      productInternalId: txn.productId,
      productId: txn.product.productId,
      productName: txn.product.name,
      sku: txn.product.sku,
      quantity: qty,
      grossSales: lineGross,
    });
  }

  const restockByMerchant = new Map<string, number>();
  for (const txn of restockTxns) {
    restockByMerchant.set(
      txn.merchantId,
      (restockByMerchant.get(txn.merchantId) ?? 0) + txn.quantity,
    );
  }

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
    topProducts: [...topProducts.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
  };
}
