import { Prisma } from '@prisma/client';
import {
  assemblePartnerEconomics,
  assembleSkuEconomics,
  type ActualRollup,
  type CatalogProduct,
  type ChannelCostSetting,
  type PartnerActivity,
  type PartnerStoreInput,
  type SkuChannelEconomics,
} from '@/lib/finance/aggregate';
import { addDays } from '@/lib/finance/calendar';
import {
  CASH_WEEK_COUNT,
  RECOGNIZED_REFILL_STATUSES,
  isFinanceChannel,
  type FinanceChannel,
} from '@/lib/finance/channels';
import {
  DEFAULT_GREEN_MIN_BPS,
  DEFAULT_YELLOW_MIN_BPS,
  emptyCashWeek,
  projectCashWeeks,
  type CashWeekInput,
  type MarginThresholds,
  type ProjectedCashWeek,
} from '@/lib/finance/formula';
import { requireFinanceAdmin } from '@/lib/finance/guard';
import { prisma } from '@/lib/prisma';

export function isFinanceSchemaMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /finance_margin_settings|finance_sku_channel_costs|finance_cash_plans|finance_cash_weeks|finance_audit_logs|food_cost_cents|packaging_cost_cents|\bP2021\b|\bP2022\b/i.test(message);
}

function num(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return 0;
}

function nullableNum(value: unknown): number | null {
  if (value == null) return null;
  const parsed = num(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type ActualRow = {
  product_id: string;
  channel: string;
  quantity: number | bigint;
  receipt_cents: number | bigint | null;
  share_cents: number | bigint | null;
  customer_paid_cents: number | bigint | null;
};

const recognizedRefillSql = Prisma.join([...RECOGNIZED_REFILL_STATUSES]);

async function loadActuals(): Promise<ActualRollup[]> {
  const [orders, sales, refills] = await Promise.all([
    prisma.$queryRaw<ActualRow[]>`
      SELECT oi."productId" AS product_id,
        CASE WHEN o.source = 'wholesale' THEN 'buyout' ELSE 'website' END AS channel,
        SUM(oi.quantity)::int AS quantity,
        ROUND(SUM(oi.subtotal) * 100)::bigint AS receipt_cents,
        NULL::bigint AS share_cents,
        NULL::bigint AS customer_paid_cents
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE oi."isGift" = false
        AND o.deleted_at IS NULL
        AND o.status <> 'cancelled'
        AND o.source IN ('website', 'shopify', 'wholesale')
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<ActualRow[]>`
      SELECT t."productId" AS product_id,
        CASE WHEN t.note LIKE '%店家收銀%' THEN 'pos' ELSE 'consignment' END AS channel,
        SUM(ABS(t.quantity))::int AS quantity,
        CASE
          WHEN SUM(CASE WHEN t."companyRevenue" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM(t."companyRevenue") * 100)::bigint
        END AS receipt_cents,
        CASE
          WHEN SUM(CASE WHEN t."commissionAmount" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM(t."commissionAmount") * 100)::bigint
        END AS share_cents,
        NULL::bigint AS customer_paid_cents
      FROM "MerchantStockTxn" t
      LEFT JOIN "Order" o ON o.id = t."orderId"
      WHERE t.type = 'sale'
        AND (
          t.note LIKE '%店家收銀%'
          OR t."orderId" IS NULL
          OR o.source = 'consignment'
        )
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<ActualRow[]>`
      SELECT product_id,
        'refill' AS channel,
        COUNT(*)::int AS quantity,
        NULL::bigint AS receipt_cents,
        NULL::bigint AS share_cents,
        (SUM(total_amount) * 100)::bigint AS customer_paid_cents
      FROM refill_orders
      WHERE product_id IS NOT NULL
        AND status IN (${recognizedRefillSql})
      GROUP BY 1
    `,
  ]);

  const actuals: ActualRollup[] = [];
  for (const row of [...orders, ...sales, ...refills]) {
    const channel = isFinanceChannel(row.channel) ? row.channel : null;
    if (!channel) continue;
    const quantity = num(row.quantity);
    actuals.push({
      productId: row.product_id,
      channel,
      quantity,
      receiptCents: nullableNum(row.receipt_cents),
      channelShareCents:
        channel === 'website' || channel === 'buyout' ? 0 : nullableNum(row.share_cents),
      customerPaidCents: nullableNum(row.customer_paid_cents),
    });
  }
  return actuals;
}

export type FinanceReport = {
  products: CatalogProduct[];
  rows: SkuChannelEconomics[];
  thresholds: MarginThresholds;
  thresholdsStored: boolean;
  partners: ReturnType<typeof assemblePartnerEconomics>;
  unassignedOrders: { orderCount: number; receiptCents: number };
  recordedShippingCents: number;
  shippingOrderCount: number;
  cash: {
    openingBalanceCents: number | null;
    minimumCashCents: number | null;
    anchorMonday: string | null;
    weeks: Array<CashWeekInput & { weekIndex: number; label: string }>;
    projected: ProjectedCashWeek[];
  };
  channelCosts: ChannelCostSetting[];
};

export async function loadFinanceReport(): Promise<FinanceReport> {
  await requireFinanceAdmin();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [
    products,
    actuals,
    channelCosts,
    settings,
    merchants,
    stocks,
    restocks,
    refillCounts,
    partnerSales,
    partnerRefills,
    unassigned,
    shipping,
    cashPlan,
  ] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        status: true,
        foodCostCents: true,
        packagingCostCents: true,
      },
      orderBy: [{ sku: 'asc' }],
    }),
    loadActuals(),
    prisma.financeSkuChannelCost.findMany(),
    prisma.financeMarginSettings.findUnique({ where: { id: 'default' } }),
    prisma.merchant.findMany({
      select: { id: true, merchantId: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.merchantStock.groupBy({
      by: ['merchantId'],
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<Array<{ merchant_id: string; recent: number | bigint; ever: number | bigint; last_at: Date | null }>>`
      SELECT "merchantId" AS merchant_id,
        COUNT(*) FILTER (WHERE "createdAt" >= ${since})::int AS recent,
        COUNT(*)::int AS ever,
        MAX("createdAt") AS last_at
      FROM "MerchantStockTxn"
      WHERE type = 'restock'
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ merchant_id: string; refill_count: number | bigint }>>`
      SELECT merchant_id, COUNT(*)::int AS refill_count
      FROM refill_orders
      WHERE status IN (${recognizedRefillSql})
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{
      merchant_id: string;
      product_id: string;
      channel: string;
      quantity: number | bigint;
      gross_cents: number | bigint | null;
      commission_cents: number | bigint | null;
      revenue_cents: number | bigint | null;
    }>>`
      SELECT t."merchantId" AS merchant_id,
        t."productId" AS product_id,
        CASE WHEN t.note LIKE '%店家收銀%' THEN 'pos' ELSE 'consignment' END AS channel,
        SUM(ABS(t.quantity))::int AS quantity,
        CASE
          WHEN SUM(CASE WHEN t."unitPrice" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM(t."unitPrice" * ABS(t.quantity)) * 100)::bigint
        END AS gross_cents,
        CASE
          WHEN SUM(CASE WHEN t."commissionAmount" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM(t."commissionAmount") * 100)::bigint
        END AS commission_cents,
        CASE
          WHEN SUM(CASE WHEN t."companyRevenue" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM(t."companyRevenue") * 100)::bigint
        END AS revenue_cents
      FROM "MerchantStockTxn" t
      LEFT JOIN "Order" o ON o.id = t."orderId"
      WHERE t.type = 'sale'
        AND (
          t.note LIKE '%店家收銀%'
          OR t."orderId" IS NULL
          OR o.source = 'consignment'
        )
      GROUP BY 1, 2, 3
    `,
    prisma.$queryRaw<Array<{ merchant_id: string; product_id: string; quantity: number | bigint; customer_paid_cents: number | bigint }>>`
      SELECT merchant_id,
        product_id,
        COUNT(*)::int AS quantity,
        (SUM(total_amount) * 100)::bigint AS customer_paid_cents
      FROM refill_orders
      WHERE product_id IS NOT NULL
        AND status IN (${recognizedRefillSql})
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<Array<{ order_count: number | bigint; receipt_cents: number | bigint }>>`
      SELECT COUNT(DISTINCT o.id)::int AS order_count,
        ROUND(COALESCE(SUM(oi.subtotal), 0) * 100)::bigint AS receipt_cents
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE oi."isGift" = false
        AND o.deleted_at IS NULL
        AND o.status <> 'cancelled'
        AND o.source IN ('line', 'subscription', 'manual')
    `,
    prisma.$queryRaw<Array<{ shipping_cents: number | bigint; order_count: number | bigint }>>`
      SELECT ROUND(COALESCE(SUM("companyShippingCost"), 0) * 100)::bigint AS shipping_cents,
        COUNT(*)::int AS order_count
      FROM "Order"
      WHERE deleted_at IS NULL
        AND status <> 'cancelled'
        AND source IN ('website', 'shopify')
    `,
    prisma.financeCashPlan.findUnique({
      where: { id: 'default' },
      include: { weeks: { orderBy: { weekIndex: 'asc' } } },
    }),
  ]);

  const thresholds: MarginThresholds = settings
    ? { greenMinBps: settings.greenMinBps, yellowMinBps: settings.yellowMinBps }
    : { greenMinBps: DEFAULT_GREEN_MIN_BPS, yellowMinBps: DEFAULT_YELLOW_MIN_BPS };
  const costs: ChannelCostSetting[] = channelCosts.map((row) => ({
    productId: row.productId,
    channel: row.channel as FinanceChannel,
    otherDirectCostCents: row.otherDirectCostCents,
    cleaningCents: row.cleaningCents,
    transportCents: row.transportCents,
    groupLeaderShareCents: row.groupLeaderShareCents,
    centerShareCents: row.centerShareCents,
  }));
  const catalog: CatalogProduct[] = products;
  const stockByMerchant = new Map(stocks.map((row) => [row.merchantId, row._sum.quantity ?? 0]));
  const restockByMerchant = new Map(restocks.map((row) => [row.merchant_id, row]));
  const refillByMerchant = new Map(refillCounts.map((row) => [row.merchant_id, num(row.refill_count)]));
  const stores: PartnerStoreInput[] = merchants.map((merchant) => {
    const restock = restockByMerchant.get(merchant.id);
    return {
      id: merchant.id,
      code: merchant.merchantId,
      name: merchant.name,
      stockUnits: stockByMerchant.get(merchant.id) ?? 0,
      restockCount90: restock ? num(restock.recent) : 0,
      everRestocked: restock ? num(restock.ever) > 0 : false,
      lastRestockAt: restock?.last_at ?? null,
      refillCount: refillByMerchant.get(merchant.id) ?? 0,
    };
  });
  const activity: PartnerActivity[] = [
    ...partnerSales.map((row) => ({
      merchantId: row.merchant_id,
      productId: row.product_id,
      channel: row.channel === 'pos' ? 'pos' as const : 'consignment' as const,
      quantity: num(row.quantity),
      grossCents: nullableNum(row.gross_cents),
      commissionCents: nullableNum(row.commission_cents),
      companyRevenueCents: nullableNum(row.revenue_cents),
      customerPaidCents: null,
    })),
    ...partnerRefills.map((row) => ({
      merchantId: row.merchant_id,
      productId: row.product_id,
      channel: 'refill' as const,
      quantity: num(row.quantity),
      grossCents: null,
      commissionCents: null,
      companyRevenueCents: null,
      customerPaidCents: nullableNum(row.customer_paid_cents),
    })),
  ];

  const storedWeeks = new Map((cashPlan?.weeks ?? []).map((week) => [week.weekIndex, week]));
  const anchor = cashPlan?.anchorMonday
    ? cashPlan.anchorMonday.toISOString().slice(0, 10)
    : null;
  const weeks = Array.from({ length: CASH_WEEK_COUNT }, (_, weekIndex) => {
    const stored = storedWeeks.get(weekIndex);
    const input: CashWeekInput = stored
      ? {
          inflowCents: stored.inflowCents,
          supplierPaymentCents: stored.supplierPaymentCents,
          packagingCents: stored.packagingCents,
          payrollCents: stored.payrollCents,
          adsCents: stored.adsCents,
          logisticsCents: stored.logisticsCents,
          samplingCents: stored.samplingCents,
        }
      : emptyCashWeek();
    const label = anchor ? `${addDays(anchor, weekIndex * 7)} 起` : `第 ${weekIndex + 1} 週`;
    return { weekIndex, label, ...input };
  });

  return {
    products: catalog,
    rows: assembleSkuEconomics({ products: catalog, actuals, settings: costs, thresholds }),
    thresholds,
    thresholdsStored: Boolean(settings),
    partners: assemblePartnerEconomics({
      stores,
      activity,
      products: catalog,
      settings: costs,
    }),
    unassignedOrders: {
      orderCount: num(unassigned[0]?.order_count),
      receiptCents: num(unassigned[0]?.receipt_cents),
    },
    recordedShippingCents: num(shipping[0]?.shipping_cents),
    shippingOrderCount: num(shipping[0]?.order_count),
    cash: {
      openingBalanceCents: cashPlan?.openingBalanceCents ?? null,
      minimumCashCents: cashPlan?.minimumCashCents ?? null,
      anchorMonday: anchor,
      weeks,
      projected: projectCashWeeks({
        openingBalanceCents: cashPlan?.openingBalanceCents ?? null,
        minimumCashCents: cashPlan?.minimumCashCents ?? null,
        weeks,
      }),
    },
    channelCosts: costs,
  };
}
