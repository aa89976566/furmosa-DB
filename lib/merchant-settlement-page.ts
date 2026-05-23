import { prisma } from '@/lib/prisma';
import { calcSettlement, defaultPeriod } from '@/lib/settlement-calc';
import { parseTaipeiDateRange } from '@/lib/taipei-date';

export function settlementDateInput(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export type MerchantSettlementPreview = {
  totalQuantity: number;
  cashCollected: number;
  commissionAmount: number;
  rewardPayout: number;
  shippingFee: number;
  merchantOwesUs: number;
  effectiveCommissionRate: number;
  lines: {
    txnId: string;
    txnNumber: string;
    orderId: string | null;
    orderNumber: string | null;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    grossSales: number;
    commissionAmount: number;
    companyRevenue: number;
    createdAt: string;
    lineSource: 'sale' | 'stocktake';
  }[];
};

export type PastSettlementRow = {
  id: string;
  settlementId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  commissionAmount: number;
  shippingFee: number;
  merchantOwesUs: number;
  payable: number;
  status: string;
  createdAt: string;
};

export async function loadMerchantSettlementPageData(
  merchantId: string,
  searchParams?: {
    settle_from?: string;
    settle_to?: string;
    settle_shipping?: string;
    settle_reward?: string;
  },
) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true, merchantId: true },
  });
  if (!merchant) return null;

  const past = await prisma.settlement.findMany({
    where: { merchantId },
    orderBy: { periodEnd: 'desc' },
    take: 30,
  });

  const def = defaultPeriod();
  const defaultFrom = settlementDateInput(def.start);
  const defaultTo = settlementDateInput(def.end);
  const settleFromStr = searchParams?.settle_from ?? null;
  const settleToStr = searchParams?.settle_to ?? null;
  const shippingFee = Number(searchParams?.settle_shipping ?? 0) || 0;
  const rewardPayout = Number(searchParams?.settle_reward ?? 0) || 0;
  const hasPreviewQuery = !!(settleFromStr && settleToStr);

  let preview: MerchantSettlementPreview | null = null;
  if (hasPreviewQuery) {
    const range = parseTaipeiDateRange(settleFromStr!, settleToStr!);
    const summary = range
      ? await calcSettlement({
          merchantId,
          periodStart: range.start,
          periodEnd: range.end,
          rewardPayout,
          shippingFee,
        })
      : null;
    if (!summary) {
      return {
        merchant,
        defaultFrom,
        defaultTo,
        currentFrom: settleFromStr,
        currentTo: settleToStr,
        shippingFee,
        rewardPayout,
        preview: null,
        pastSettlements: past.map((s) => ({
          id: s.id,
          settlementId: s.settlementId,
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          grossSales: Number(s.grossSales),
          commissionAmount: Number(s.commissionAmount),
          shippingFee: Number(s.shippingFee),
          merchantOwesUs: Number(s.merchantOwesUs),
          payable: Number(s.payable),
          status: s.status,
          createdAt: s.createdAt.toISOString(),
        })),
        hasPreviewQuery: false,
      };
    }
    preview = {
      totalQuantity: summary.totalQuantity,
      cashCollected: summary.cashCollected,
      commissionAmount: summary.commissionAmount,
      rewardPayout: summary.rewardPayout,
      shippingFee: summary.shippingFee,
      merchantOwesUs: summary.merchantOwesUs,
      effectiveCommissionRate: summary.effectiveCommissionRate,
      lines: summary.lines.map((l) => ({
        txnId: l.txnId,
        txnNumber: l.txnNumber,
        orderId: l.orderId,
        orderNumber: l.orderNumber,
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        grossSales: l.grossSales,
        commissionAmount: l.commissionAmount,
        companyRevenue: l.companyRevenue,
        createdAt: l.createdAt.toISOString(),
        lineSource: l.lineSource,
      })),
    };
  }

  const pastSettlements: PastSettlementRow[] = past.map((s) => ({
    id: s.id,
    settlementId: s.settlementId,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    grossSales: Number(s.grossSales),
    commissionAmount: Number(s.commissionAmount),
    shippingFee: Number(s.shippingFee),
    merchantOwesUs: Number(s.merchantOwesUs),
    payable: Number(s.payable),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));

  return {
    merchant,
    defaultFrom,
    defaultTo,
    currentFrom: settleFromStr,
    currentTo: settleToStr,
    shippingFee,
    rewardPayout,
    preview,
    pastSettlements,
    hasPreviewQuery,
  };
}
