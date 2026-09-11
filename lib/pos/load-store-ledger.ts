import { prisma } from '@/lib/prisma';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';
import { formatRefillOrderNo } from '@/lib/pos/refill-view';
import { storeHeading } from '@/lib/pos/store-display';
import {
  classifyCouponSubsidy,
  classifyPaymentOrder,
  classifyRestockCost,
  classifyUnpaidRefill,
  groupRefillReconciliations,
  sortLedgerEntries,
  summarizeStoreLedger,
  toLedgerEntryView,
  type LedgerEntry,
  type LedgerEntryView,
  type StoreLedgerSummary,
} from '@/lib/pos/store-ledger';
import {
  classifyConsignmentSaleTxn,
  classifyCouponSource,
  dedupeSources,
  pendingSource,
  storeCollectionSource,
  type PendingSource,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';
import {
  buildSettlementDraft,
  settlementWriteEnabled,
  type SettlementDraft,
  type SettlementPaymentMethod,
} from '@/lib/settlements/write-settlement';
import {
  countVoidedAttempts,
  loadMerchantSettlementHistory,
} from '@/lib/settlements/read-snapshot';

const BILLABLE_RESTOCK_STATUSES = ['approved', 'converted_to_shipment'] as const;

/** 送出前顯示的暫計。與 legacy 對帳摘要分開呈現，不可混為同一個數字。 */
export type SettlementPreview = {
  sourceCount: number;
  grossSales: number;
  commissionAmount: number;
  rewardPayout: number;
  storeCollected: number;
  netPayableTwd: number;
  direction: SettlementDraft['totals']['direction'];
  sourceKeysDigest: string;
  amountsDigest: string;
  lines: Array<{
    sourceKey: string;
    sourceKind: SettlementSourceDraft['sourceKind'];
    direction: SettlementSourceDraft['direction'];
    label: string;
    originalAmount: number;
    commissionAmount: number | null;
    occurredAt: string;
  }>;
};

export type PendingSourceView = {
  reason: PendingSource['reason'];
  reasonLabel: string;
  sourceKind: string;
  sourceRef: string;
  occurredAt: string;
  label: string;
};

export type SettlementHistoryRow = {
  id: string;
  settlementNo: string;
  status: string;
  isNewVersion: boolean;
  netPayableTwd: number | null;
  merchantOwesUs: number;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  countsTowardValidTotals: boolean;
};

export type StoreLedgerPageData = {
  storeId: string;
  storeLabel: string;
  periodStart: string;
  periodEnd: string;
  summary: StoreLedgerSummary;
  entries: LedgerEntryView[];
  refillRows: ReturnType<typeof groupRefillReconciliations>;
  /** 伺服器端寫入開關。關閉時 UI 必須顯示可讀提示，不得假裝成功。 */
  persistAvailable: boolean;
  amountNotes: string[];
  preview: SettlementPreview;
  pending: PendingSourceView[];
  history: SettlementHistoryRow[];
  historyAvailable: boolean;
};

type LoadOptions = {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
};

function paidPayment(status: string, paidAt: Date | null): boolean {
  return status === 'paid' && paidAt != null;
}

function previewFromDraft(draft: SettlementDraft): SettlementPreview {
  return {
    sourceCount: draft.sources.length,
    grossSales: draft.totals.grossSales,
    commissionAmount: draft.totals.commissionAmount,
    rewardPayout: draft.totals.rewardPayout,
    storeCollected: draft.totals.storeCollected,
    netPayableTwd: draft.totals.netPayableTwd,
    direction: draft.totals.direction,
    sourceKeysDigest: draft.sourceKeysDigest,
    amountsDigest: draft.amountsDigest,
    lines: draft.sources.map((source) => ({
      sourceKey: source.sourceKey,
      sourceKind: source.sourceKind,
      direction: source.direction,
      label: source.label,
      originalAmount: source.originalAmount,
      commissionAmount: source.commissionAmount,
      occurredAt: source.occurredAt.toISOString(),
    })),
  };
}

export async function loadStoreLedgerPageData(options: LoadOptions): Promise<StoreLedgerPageData> {
  const { entries, summary, amountNotes, storeLabel, storeId, sources, pending } =
    await loadStoreLedger(options);

  const [attempts, history] = await Promise.all([
    countVoidedAttempts(
      prisma,
      storeId,
      sources.map((source) => source.sourceKey),
    ),
    loadMerchantSettlementHistory(prisma, storeId),
  ]);

  const draft = buildSettlementDraft({
    merchantId: storeId,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    intendedPaymentMethod: previewPaymentMethod(summary.payer),
    operationSeq: attempts.operationSeq,
    sources,
  });

  return {
    storeId,
    storeLabel,
    periodStart: options.periodStart.toISOString(),
    periodEnd: options.periodEnd.toISOString(),
    summary,
    entries: sortLedgerEntries(entries).map(toLedgerEntryView),
    refillRows: groupRefillReconciliations(entries),
    persistAvailable: settlementWriteEnabled(),
    amountNotes,
    preview: previewFromDraft(draft),
    pending: pending.map((item) => ({
      reason: item.reason,
      reasonLabel: item.reasonLabel,
      sourceKind: item.sourceKind,
      sourceRef: item.sourceRef,
      occurredAt: item.occurredAt.toISOString(),
      label: item.label,
    })),
    history: history.rows.map((row) => ({
      id: row.id,
      settlementNo: row.settlementNo,
      status: row.status,
      isNewVersion: row.rulesVersion != null,
      netPayableTwd: row.netPayableTwd,
      merchantOwesUs: row.merchantOwesUs,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      countsTowardValidTotals: row.countsTowardValidTotals,
    })),
    historyAvailable: history.available,
  };
}

/** 預覽用的預設付款方式。付款方式納入操作 key，送出前改選會產生新的 key。 */
function previewPaymentMethod(payer: StoreLedgerSummary['payer']): SettlementPaymentMethod {
  if (payer === 'FURMOSA') return 'FURMOSA_TO_STORE_TRANSFER';
  if (payer === 'NONE') return 'NONE';
  return 'BANK_TRANSFER';
}

export async function loadStoreLedger(options: LoadOptions): Promise<{
  storeId: string;
  storeLabel: string;
  entries: LedgerEntry[];
  summary: StoreLedgerSummary;
  amountNotes: string[];
  /** 可認列的結算來源。缺價或歸屬不可靠者不在此列。 */
  sources: SettlementSourceDraft[];
  /** 待確認來源。不計金額、不寫入、不占唯一鍵。 */
  pending: PendingSource[];
}> {
  const merchant = await prisma.merchant.findFirst({
    where: { id: options.merchantId },
    select: { id: true, merchantId: true, name: true, city: true },
  });
  if (!merchant) {
    return {
      storeId: options.merchantId,
      storeLabel: '店家',
      entries: [],
      summary: summarizeStoreLedger([]),
      amountNotes: [],
      sources: [],
      pending: [],
    };
  }

  const storeSlug = merchantToStoreSlug(merchant.merchantId);
  const heading = storeHeading({ name: merchant.name, city: merchant.city });
  const amountNotes: string[] = [];
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, slug: true, name: true },
  });

  const [refillOrders, coupons, redemptions, restocks, stockTxns] = await Promise.all([
    prisma.refillOrder.findMany({
      where: {
        merchantId: merchant.id,
        status: { not: 'draft' },
        OR: [
          { createdAt: { gte: options.periodStart, lte: options.periodEnd } },
          { paidAt: { gte: options.periodStart, lte: options.periodEnd } },
          {
            payments: {
              some: { paidAt: { gte: options.periodStart, lte: options.periodEnd } },
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        orderType: true,
        baseAmount: true,
        extraAmount: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
        oldContainerSerial: true,
        newContainerSerial: true,
        customerId: true,
        customer: { select: { id: true, name: true } },
        payments: {
          select: {
            id: true,
            purpose: true,
            status: true,
            amount: true,
            provider: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.groomingCoupon.findMany({
      where: {
        status: 'redeemed',
        redeemedAt: { gte: options.periodStart, lte: options.periodEnd },
        OR: [
          { storeId: storeSlug },
          { storeId: merchant.merchantId },
          ...(store ? [{ storeId: store.id }] : []),
          { storeName: merchant.name },
        ],
      },
      select: {
        id: true,
        couponCode: true,
        discountAmount: true,
        redeemedAt: true,
        customerId: true,
        storeId: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.rewardRedemption.findMany({
      where: {
        partnerMerchantId: merchant.id,
        couponStatus: 'used',
        usedAt: { gte: options.periodStart, lte: options.periodEnd },
      },
      select: {
        id: true,
        couponCode: true,
        usedAt: true,
        customerId: true,
        customer: { select: { id: true, name: true } },
        reward: { select: { couponFaceValue: true } },
      },
    }),
    prisma.restockRequest.findMany({
      where: {
        merchantId: merchant.id,
        status: { in: [...BILLABLE_RESTOCK_STATUSES] },
        OR: [
          { approvedAt: { gte: options.periodStart, lte: options.periodEnd } },
          {
            approvedAt: null,
            createdAt: { gte: options.periodStart, lte: options.periodEnd },
          },
        ],
      },
      select: {
        id: true,
        approvedAt: true,
        createdAt: true,
        shipment: {
          select: {
            shipmentNumber: true,
            order: { select: { orderNumber: true } },
          },
        },
        items: {
          select: {
            requestedQuantity: true,
            approvedQuantity: true,
            product: { select: { name: true, cost: true } },
          },
        },
      },
    }),
    // 寄賣流水。只取尚未被任何結算鎖住的，避免重複結算。
    prisma.merchantStockTxn.findMany({
      where: {
        merchantId: merchant.id,
        settlementId: null,
        type: { in: ['sale', 'adjust'] },
        createdAt: { gte: options.periodStart, lte: options.periodEnd },
      },
      select: {
        id: true,
        txnNumber: true,
        type: true,
        quantity: true,
        unitPrice: true,
        commissionAmount: true,
        companyRevenue: true,
        orderId: true,
        productId: true,
        createdAt: true,
        product: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  const storeKey = store?.id ?? storeSlug;
  const couponCodes = new Set<string>();
  const entries: LedgerEntry[] = [];

  for (const order of refillOrders) {
    const refillDisplay = formatRefillOrderNo(order.id, order.createdAt);
    const jarSerial = order.oldContainerSerial ?? order.newContainerSerial;
    const paidRefill =
      order.paidAt != null ||
      order.payments.some(
        (payment) => payment.purpose === 'refill' && paidPayment(payment.status, payment.paidAt),
      );
    const inPeriod = (date: Date | null) =>
      Boolean(date && date >= options.periodStart && date <= options.periodEnd);

    for (const payment of order.payments) {
      const occurred = payment.paidAt ?? payment.createdAt;
      if (!inPeriod(occurred)) continue;
      const purpose = payment.purpose === 'extra_topup' ? 'extra_topup' : 'refill';
      const entry = classifyPaymentOrder({
        id: payment.id,
        purpose,
        status: payment.status,
        amount: payment.amount,
        provider: payment.provider,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        refillOrderId: order.id,
        refillDisplay,
        refillOrderType: order.orderType,
        customerId: order.customerId,
        customerName: order.customer.name,
        jarSerial,
        storeId: merchant.id,
      });
      if (entry) entries.push(entry);
    }

    const unpaidLike =
      order.status === 'payment_pending' ||
      order.status === 'payment_failed' ||
      order.status === 'cancelled' ||
      order.status === 'expired' ||
      (!paidRefill && order.status !== 'completed');

    if (unpaidLike && !paidRefill && inPeriod(order.createdAt)) {
      entries.push(
        classifyUnpaidRefill({
          id: order.id,
          createdAt: order.createdAt,
          amount: order.baseAmount || order.totalAmount,
          refillDisplay,
          customerId: order.customerId,
          customerName: order.customer.name,
          jarSerial,
          storeId: merchant.id,
          paymentStatus:
            order.status === 'payment_failed'
              ? 'failed'
              : order.status === 'cancelled' || order.status === 'expired'
                ? 'cancelled'
                : 'pending',
        }),
      );
    }
  }

  for (const coupon of coupons) {
    if (!coupon.redeemedAt) continue;
    couponCodes.add(coupon.couponCode.toLowerCase());
    entries.push(
      classifyCouponSubsidy({
        id: coupon.id,
        customerId: coupon.customerId,
        customerName: coupon.customer.name,
        couponId: coupon.id,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        relatedRefillOrderId: null,
        relatedRefillDisplay: null,
        storeId: coupon.storeId || storeKey,
        redeemedAt: coupon.redeemedAt,
      }),
    );
  }

  for (const redemption of redemptions) {
    const code = (redemption.couponCode ?? '').toLowerCase();
    if (code && couponCodes.has(code)) continue;
    if (!redemption.usedAt) continue;
    entries.push(
      classifyCouponSubsidy({
        id: redemption.id,
        customerId: redemption.customerId,
        customerName: redemption.customer.name,
        couponId: redemption.id,
        couponCode: redemption.couponCode ?? redemption.id,
        discountAmount: redemption.reward.couponFaceValue,
        relatedRefillOrderId: null,
        relatedRefillDisplay: null,
        storeId: merchant.id,
        redeemedAt: redemption.usedAt,
      }),
    );
  }

  const pending: PendingSource[] = [];

  // 寄賣進貨不是買斷應付款，且 RestockRequestItem 沒有價格欄位。
  // 既有實作以 Product.cost 估算金額，違反「不得以成本回推金額」，因此：
  // 金額不再以成本估算、不列入結算，改為待確認並保留該列可見。
  for (const restock of restocks) {
    const names = restock.items
      .map((item) => item.product.name)
      .filter(Boolean)
      .slice(0, 3)
      .join('、');
    const relatedOrderDisplay =
      restock.shipment?.order?.orderNumber ||
      restock.shipment?.shipmentNumber ||
      `補貨 ${restock.id.slice(-6).toUpperCase()}`;
    const occurredAt = restock.approvedAt ?? restock.createdAt;
    const content = names ? `補貨單 ${relatedOrderDisplay} ${names}` : `補貨單 ${relatedOrderDisplay}`;
    entries.push(
      classifyRestockCost({
        id: restock.id,
        occurredAt,
        amount: 0,
        relatedOrderId: restock.id,
        relatedOrderDisplay,
        storeId: merchant.id,
        content,
        settlementStatus: 'EXCLUDED',
      }),
    );
    pending.push(
      pendingSource({
        reason: 'RESTOCK_NO_TRUSTED_PRICE',
        sourceKind: 'restock',
        sourceRef: restock.id,
        occurredAt,
        label: content,
      }),
    );
  }

  // 寄賣銷售：只認已存 unitPrice 與 commissionAmount 的 sale 流水。
  const rawSources: SettlementSourceDraft[] = [];
  for (const txn of stockTxns) {
    if (txn.type === 'adjust' && txn.quantity >= 0) continue;
    const classified = classifyConsignmentSaleTxn({
      id: txn.id,
      txnNumber: txn.txnNumber,
      type: txn.type,
      quantity: txn.quantity,
      unitPrice: txn.unitPrice,
      commissionAmount: txn.commissionAmount,
      companyRevenue: txn.companyRevenue,
      orderId: txn.orderId,
      orderNumber: txn.order?.orderNumber ?? null,
      productId: txn.productId,
      productName: txn.product.name,
      createdAt: txn.createdAt,
    });
    if (classified.kind === 'source') rawSources.push(classified.source);
    else pending.push(classified.pending);
  }

  // 券補貼：storeId 命中 slug／merchantId／Store.id 才算歸屬可靠；只靠店名不算。
  const reliableStoreKeys = new Set(
    [storeSlug, merchant.merchantId, store?.id].filter((key): key is string => Boolean(key)),
  );
  for (const coupon of coupons) {
    if (!coupon.redeemedAt) continue;
    const classified = classifyCouponSource({
      id: coupon.id,
      model: 'grooming_coupon',
      rawCouponCode: coupon.couponCode,
      faceValue: coupon.discountAmount,
      redeemedAt: coupon.redeemedAt,
      storeAttributionReliable: reliableStoreKeys.has(coupon.storeId ?? ''),
      customerName: coupon.customer.name,
      relatedOrderId: null,
    });
    if (classified.kind === 'source') rawSources.push(classified.source);
    else pending.push(classified.pending);
  }
  for (const redemption of redemptions) {
    if (!redemption.usedAt) continue;
    const classified = classifyCouponSource({
      id: redemption.id,
      model: 'reward_redemption',
      rawCouponCode: redemption.couponCode,
      faceValue: redemption.reward.couponFaceValue,
      redeemedAt: redemption.usedAt,
      // partnerMerchantId 是直接外鍵，歸屬可靠。
      storeAttributionReliable: true,
      customerName: redemption.customer.name,
      relatedOrderId: null,
    });
    if (classified.kind === 'source') rawSources.push(classified.source);
    else pending.push(classified.pending);
  }

  // 店家代收現金：沿用既有分類結果，只取店家實際收到現金且尚未結清的流水。
  for (const entry of entries) {
    if (entry.sourceKind !== 'payment') continue;
    if (entry.paymentCollector !== 'STORE') continue;
    if (entry.fundDirection !== 'STORE_TO_FURMOSA') continue;
    if (entry.settlementStatus !== 'UNSETTLED') continue;
    if (entry.amount === 0) continue;
    rawSources.push(
      storeCollectionSource({
        paymentId: entry.sourceId,
        amount: entry.amount,
        occurredAt: entry.occurredAt,
        relatedOrderId: entry.relatedOrderId,
        label: `${entry.content}（${entry.relatedOrderDisplay}）`,
        snapshot: {
          paymentId: entry.sourceId,
          transactionType: entry.transactionType,
          amount: entry.amount,
          paymentCollector: entry.paymentCollector,
          relatedOrderId: entry.relatedOrderId,
          relatedOrderDisplay: entry.relatedOrderDisplay,
          customerId: entry.customerId,
          customerName: entry.customerName,
          occurredAt: entry.occurredAt.toISOString(),
        },
      }),
    );
  }

  const deduped = dedupeSources(rawSources);
  pending.push(...deduped.conflicts);

  amountNotes.push('進貨單沒有可信成交價，不列入本期金額，會列在待確認。');
  amountNotes.push('忘帶空罐補差額目前是客人線上付給匠寵，不會算進店家應付。');
  amountNotes.push('10 點優惠券是獨立補貼流水，不會只在訂單總額上減掉。');

  return {
    storeId: merchant.id,
    storeLabel: heading.combined,
    entries,
    summary: summarizeStoreLedger(entries),
    amountNotes,
    sources: deduped.sources,
    pending: pending.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()),
  };
}
