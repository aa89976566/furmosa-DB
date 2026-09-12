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
  computeLegacyTotals,
  dedupeSources,
  pendingSource,
  storeCollectionSource,
  type PendingSource,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';
import {
  allowedPaymentMethods,
  buildSettleOverview,
  payerFromDirection,
  paymentMethodLabel,
  type SettleOverview,
  type StoreSettlementPaymentMethod,
  type StoreSettlementSnapshot,
} from '@/lib/pos/store-settlement';
import {
  buildSettlementDraft,
  settlementReadiness,
  settlementWriteEnabled,
  type SettlementDraft,
} from '@/lib/settlements/write-settlement';
import {
  countVoidedAttempts,
  loadActiveSourceKeys,
  loadMerchantSettlementHistory,
} from '@/lib/settlements/read-snapshot';

const BILLABLE_RESTOCK_STATUSES = ['approved', 'converted_to_shipment'] as const;

/**
 * 送出前顯示的暫計。與 legacy 對帳摘要分開呈現，不可混為同一個數字。
 *
 * 付款方式納入冪等 key，所以每個可選方式都有自己的 key 與指紋：`methods`。
 * 這裡刻意**不提供**單一的 `idempotencyKey`，否則切換付款方式時畫面會拿著
 * 別的方式算出來的 key 去送出。
 */
export type SettlementPreview = {
  sourceCount: number;
  grossSales: number;
  commissionAmount: number;
  rewardPayout: number;
  storeCollected: number;
  netPayableTwd: number;
  direction: SettlementDraft['totals']['direction'];
  /** 由可信且未鎖定來源的 Decimal 淨額推導，不取 legacy 對帳摘要。 */
  payer: StoreSettlementSnapshot['payer'];
  sourceKeysDigest: string;
  amountsDigest: string;
  /** 每個可選付款方式各自的 key 與指紋。只供比對與查詢，不參與金額計算。 */
  methods: Array<{
    method: StoreSettlementPaymentMethod;
    label: string;
    idempotencyKey: string;
    payloadFingerprint: string;
  }>;
  /** 已被其他結帳單鎖住而未列入暫計的筆數。 */
  lockedSourceCount: number;
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
  /** legacy 對帳明細摘要。**只**給明細拆解區看，不是結帳金額。 */
  summary: StoreLedgerSummary;
  /** 四張卡、付款方向與主要總額的唯一來源。由可結算 sources 的 Decimal totals 推導。 */
  overview: SettleOverview;
  entries: LedgerEntryView[];
  refillRows: ReturnType<typeof groupRefillReconciliations>;
  /** 伺服器端寫入開關與鎖定狀態都就緒才為 true。false 時 UI 必須顯示可讀提示。 */
  persistAvailable: boolean;
  /** 不能送出的原因。null 表示可以送出。 */
  persistBlockedReason: string | null;
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

function previewFromDrafts(
  drafts: readonly SettlementDraft[],
  lockedSourceCount: number,
): SettlementPreview {
  // 金額不隨付款方式改變，取任一份即可；key 與指紋才是逐方式不同。
  const draft = drafts[0]!;
  return {
    sourceCount: draft.sources.length,
    lockedSourceCount,
    payer: payerFromDirection(draft.totals.direction),
    methods: drafts.map((item) => ({
      method: item.intendedPaymentMethod,
      label: paymentMethodLabel(item.intendedPaymentMethod),
      idempotencyKey: item.idempotencyKey,
      payloadFingerprint: item.payloadFingerprint,
    })),
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
  const {
    entries,
    summary,
    amountNotes,
    storeLabel,
    storeId,
    sources,
    lockedSourceCount,
    lockStateAvailable,
    pending,
  } = await loadStoreLedger(options);

  const [attempts, history] = await Promise.all([
    countVoidedAttempts(
      prisma,
      storeId,
      sources.map((source) => source.sourceKey),
    ),
    loadMerchantSettlementHistory(prisma, storeId),
  ]);

  // 預覽與送出共用同一個就緒判斷：讀不到鎖定狀態不得當成沒有鎖繼續。
  const readiness = settlementReadiness({
    writeEnabled: settlementWriteEnabled(),
    lockStateAvailable,
    operationSeqAvailable: attempts.available,
  });

  // 付款方向必須由可信且未鎖定來源的 Decimal 淨額決定，不看 legacy summary.payer。
  // 每個可選方式都各算一份 key，畫面切換時不需要重新往返，也不會用錯 key。
  const previewTotals = computeLegacyTotals(sources);
  const drafts = allowedPaymentMethods(payerFromDirection(previewTotals.direction)).map((method) =>
    buildSettlementDraft({
      merchantId: storeId,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      intendedPaymentMethod: method,
      operationSeq: attempts.operationSeq,
      sources,
    }),
  );

  const periodStartIso = options.periodStart.toISOString();
  const periodEndIso = options.periodEnd.toISOString();
  const historyRows = history.rows.map((row) => ({
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
  }));

  return {
    storeId,
    storeLabel,
    periodStart: periodStartIso,
    periodEnd: periodEndIso,
    summary,
    overview: buildSettleOverview({
      totals: previewTotals,
      history: historyRows,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
    }),
    entries: sortLedgerEntries(entries).map(toLedgerEntryView),
    refillRows: groupRefillReconciliations(entries),
    persistAvailable: readiness.ok,
    persistBlockedReason: readiness.ok ? null : readiness.error,
    amountNotes,
    preview: previewFromDrafts(drafts, lockedSourceCount),
    pending: pending.map((item) => ({
      reason: item.reason,
      reasonLabel: item.reasonLabel,
      sourceKind: item.sourceKind,
      sourceRef: item.sourceRef,
      occurredAt: item.occurredAt.toISOString(),
      label: item.label,
    })),
    history: historyRows,
    historyAvailable: history.available,
  };
}

export async function loadStoreLedger(options: LoadOptions): Promise<{
  storeId: string;
  storeLabel: string;
  entries: LedgerEntry[];
  summary: StoreLedgerSummary;
  amountNotes: string[];
  /** 可認列的結算來源。缺價、歸屬不可靠或已被其他結帳單鎖住者不在此列。 */
  sources: SettlementSourceDraft[];
  /** 已被其他結帳單鎖住而排除的來源筆數。 */
  lockedSourceCount: number;
  /**
   * 是否真的讀到了鎖定狀態。缺表環境讀不到時為 false。
   *
   * false **不等於沒有鎖**，所以不能當成空的鎖集合繼續送出；由呼叫端擋下寫入。
   */
  lockStateAvailable: boolean;
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
      lockedSourceCount: 0,
      lockStateAvailable: true,
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
    const reliable = reliableStoreKeys.has(coupon.storeId ?? '');
    const classified = classifyCouponSource({
      id: coupon.id,
      model: 'grooming_coupon',
      rawCouponCode: coupon.couponCode,
      faceValue: coupon.discountAmount,
      redeemedAt: coupon.redeemedAt,
      storeAttributionReliable: reliable,
      // 歸屬 key 一律正規化成 Merchant.id。GroomingCoupon.storeId 可能存 slug、
      // merchantId 或 Store.id，直接拿原值比對會把同一家店判成兩家。
      storeKey: reliable ? merchant.id : null,
      customerId: coupon.customerId,
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
      storeKey: merchant.id,
      customerId: redemption.customerId,
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

  // 分類階段已擋下的待確認要一起傳進去：歧義券的另一側不得單獨認列。
  const deduped = dedupeSources(rawSources, pending);
  pending.push(...deduped.conflicts);

  // 已被其他結帳單鎖住的來源必須從暫計裡排除。
  // 寄賣銷售靠 MerchantStockTxn.settlementId 過濾，但券與代收付款沒有欄位鎖，
  // 它們的鎖就是 active canonical 唯一鍵；不排除就會讓已結過的金額重複出現。
  const lock = await loadActiveSourceKeys(
    prisma,
    merchant.id,
    deduped.sources.map((source) => source.sourceKey),
  );
  const sources = deduped.sources.filter((source) => !lock.lockedKeys.has(source.sourceKey));
  const lockedSourceCount = deduped.sources.length - sources.length;

  amountNotes.push('進貨單沒有可信成交價，不列入本期金額，會列在待確認。');
  amountNotes.push('忘帶空罐補差額目前是客人線上付給匠寵，不會算進店家應付。');
  amountNotes.push('10 點優惠券是獨立補貼流水，不會只在訂單總額上減掉。');

  return {
    storeId: merchant.id,
    storeLabel: heading.combined,
    entries,
    summary: summarizeStoreLedger(entries),
    amountNotes,
    sources,
    lockedSourceCount,
    lockStateAvailable: lock.available,
    pending: pending.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()),
  };
}
