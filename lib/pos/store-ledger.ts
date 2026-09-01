/**
 * 店家 POS「結帳」對帳流水。
 * 這不是客人收銀，而是泡泡堂 ↔ 匠寵的應收應付。
 *
 * 金流方向由交易類型與實際收款方決定，店員不可改。
 */

export type PaymentCollector = 'FURMOSA' | 'STORE' | 'NONE';
export type FundDirection = 'STORE_TO_FURMOSA' | 'FURMOSA_TO_STORE' | 'NO_SETTLEMENT';
export type SettlementStatus = 'UNSETTLED' | 'SETTLED' | 'EXCLUDED';

export type LedgerTxnType =
  | 'REFILL_FEE'
  | 'EMPTY_JAR_SURCHARGE'
  | 'STORE_COLLECTION'
  | 'COUPON_SUBSIDY'
  | 'COUPON_REVERSAL'
  | 'RESTOCK_COST'
  | 'REBATE'
  | 'ADJUSTMENT';

export type LedgerEntry = {
  id: string;
  sourceKind: 'payment' | 'coupon' | 'reward' | 'restock' | 'unpaid_refill' | 'adjustment';
  sourceId: string;
  transactionType: LedgerTxnType;
  occurredAt: Date;
  amount: number;
  paymentCollector: PaymentCollector;
  fundDirection: FundDirection;
  settlementStatus: SettlementStatus;
  relatedOrderId: string | null;
  relatedOrderDisplay: string;
  storeId: string;
  customerId: string | null;
  customerName: string;
  content: string;
  remark: string | null;
  couponId: string | null;
  couponCode: string | null;
  jarSerial: string | null;
  searchText: string;
};

export type StoreLedgerSummary = {
  storeOwesFurmosa: number;
  furmosaOwesStore: number;
  settledAmount: number;
  netAmount: number;
  payer: 'STORE' | 'FURMOSA' | 'NONE';
  receiver: 'STORE' | 'FURMOSA' | 'NONE';
  resultLabel: string;
  restockCost: number;
  storeCollections: number;
  otherStorePayables: number;
  couponSubsidy: number;
  rebates: number;
  otherFurmosaPayables: number;
};

export type NetSettlementResult = {
  netAmount: number;
  absoluteAmount: number;
  payer: StoreLedgerSummary['payer'];
  receiver: StoreLedgerSummary['receiver'];
  resultLabel: string;
};

export type LedgerFilter = {
  type?: LedgerTxnType | 'all';
  status?: SettlementStatus | 'all';
  collector?: PaymentCollector | 'all';
  query?: string;
};

export type CouponSubsidySource = {
  id: string;
  customerId: string;
  customerName: string;
  couponId: string;
  couponCode: string;
  discountAmount: number;
  relatedRefillOrderId: string | null;
  relatedRefillDisplay: string | null;
  storeId: string;
  redeemedAt: Date;
  settlementStatus?: SettlementStatus;
};

export type PaidPaymentSource = {
  id: string;
  purpose: 'refill' | 'extra_topup';
  status: string;
  amount: number;
  provider: string;
  paidAt: Date | null;
  createdAt: Date;
  refillOrderId: string;
  refillDisplay: string;
  refillOrderType: 'first' | 'exchange' | string;
  customerId: string | null;
  customerName: string;
  jarSerial: string | null;
  storeId: string;
  settlementStatus?: SettlementStatus;
};

export type UnpaidRefillSource = {
  id: string;
  createdAt: Date;
  amount: number;
  refillDisplay: string;
  customerId: string | null;
  customerName: string;
  jarSerial: string | null;
  storeId: string;
  paymentStatus: 'pending' | 'failed' | 'cancelled';
};

export type RestockCostSource = {
  id: string;
  occurredAt: Date;
  amount: number;
  relatedOrderId: string;
  relatedOrderDisplay: string;
  storeId: string;
  content: string;
  settlementStatus?: SettlementStatus;
};

export type AdjustmentSource = {
  id: string;
  occurredAt: Date;
  amount: number;
  direction: Exclude<FundDirection, 'NO_SETTLEMENT'>;
  reason: string;
  createdBy: string;
  storeId: string;
  relatedOrderId: string | null;
  relatedOrderDisplay: string;
};

export function toNtd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function collectorFromProvider(provider: string | null | undefined): PaymentCollector {
  const value = (provider ?? '').trim().toLowerCase();
  if (value === 'cash' || value === 'store_cash' || value === 'pos_cash') return 'STORE';
  if (!value || value === 'ecpay' || value === 'line_pay' || value === 'credit_card') return 'FURMOSA';
  return 'FURMOSA';
}

export function classifyPaymentOrder(source: PaidPaymentSource): LedgerEntry | null {
  const occurredAt = source.paidAt ?? source.createdAt;
  const amount = toNtd(source.amount);
  const paid = source.status === 'paid' && amount > 0;
  const collector = collectorFromProvider(source.provider);

  if (!paid) {
    return {
      id: `payment:${source.id}`,
      sourceKind: 'payment',
      sourceId: source.id,
      transactionType: source.purpose === 'extra_topup' ? 'EMPTY_JAR_SURCHARGE' : 'REFILL_FEE',
      occurredAt,
      amount,
      paymentCollector: collector,
      fundDirection: 'NO_SETTLEMENT',
      settlementStatus: 'EXCLUDED',
      relatedOrderId: source.refillOrderId,
      relatedOrderDisplay: source.refillDisplay,
      storeId: source.storeId,
      customerId: source.customerId,
      customerName: source.customerName,
      content: `${source.customerName} ${source.purpose === 'extra_topup' ? '補差額' : '換罐'}`.trim(),
      remark: source.status === 'failed' ? '付款失敗' : '尚未付款',
      couponId: null,
      couponCode: null,
      jarSerial: source.jarSerial,
      searchText: buildSearchText([
        source.refillDisplay,
        source.refillOrderId,
        source.customerName,
        source.jarSerial,
      ]),
    };
  }

  if (source.purpose === 'refill') {
    const firstJar = source.refillOrderType === 'first';
    return {
      id: `payment:${source.id}`,
      sourceKind: 'payment',
      sourceId: source.id,
      transactionType: 'REFILL_FEE',
      occurredAt,
      amount,
      paymentCollector: 'FURMOSA',
      fundDirection: 'NO_SETTLEMENT',
      settlementStatus: source.settlementStatus ?? 'EXCLUDED',
      relatedOrderId: source.refillOrderId,
      relatedOrderDisplay: source.refillDisplay,
      storeId: source.storeId,
      customerId: source.customerId,
      customerName: source.customerName,
      content: `${source.customerName} ${firstJar ? '首罐' : '換罐'}`.trim(),
      remark: '客人線上付款給匠寵，不列入店家應付',
      couponId: null,
      couponCode: null,
      jarSerial: source.jarSerial,
      searchText: buildSearchText([
        source.refillDisplay,
        source.refillOrderId,
        source.customerName,
        source.jarSerial,
      ]),
    };
  }

  // extra_topup：實際金流看收款方。綠界線上付 = 匠寵已收；店家收現金才回匯。
  if (collector === 'STORE') {
    return {
      id: `payment:${source.id}`,
      sourceKind: 'payment',
      sourceId: source.id,
      transactionType: 'EMPTY_JAR_SURCHARGE',
      occurredAt,
      amount,
      paymentCollector: 'STORE',
      fundDirection: 'STORE_TO_FURMOSA',
      settlementStatus: source.settlementStatus ?? 'UNSETTLED',
      relatedOrderId: source.refillOrderId,
      relatedOrderDisplay: source.refillDisplay,
      storeId: source.storeId,
      customerId: source.customerId,
      customerName: source.customerName,
      content: `${source.customerName} 忘記帶空罐`.trim(),
      remark: '店家代收，待回匠寵',
      couponId: null,
      couponCode: null,
      jarSerial: source.jarSerial,
      searchText: buildSearchText([
        source.refillDisplay,
        source.refillOrderId,
        source.customerName,
        source.jarSerial,
      ]),
    };
  }

  return {
    id: `payment:${source.id}`,
    sourceKind: 'payment',
    sourceId: source.id,
    transactionType: 'EMPTY_JAR_SURCHARGE',
    occurredAt,
    amount,
    paymentCollector: 'FURMOSA',
    fundDirection: 'NO_SETTLEMENT',
    settlementStatus: source.settlementStatus ?? 'EXCLUDED',
    relatedOrderId: source.refillOrderId,
    relatedOrderDisplay: source.refillDisplay,
    storeId: source.storeId,
    customerId: source.customerId,
    customerName: source.customerName,
    content: `${source.customerName} 忘記帶空罐`.trim(),
    remark: '客人線上補差額給匠寵，不列入店家應付',
    couponId: null,
    couponCode: null,
    jarSerial: source.jarSerial,
    searchText: buildSearchText([
      source.refillDisplay,
      source.refillOrderId,
      source.customerName,
      source.jarSerial,
    ]),
  };
}

export function classifyUnpaidRefill(source: UnpaidRefillSource): LedgerEntry {
  const remark =
    source.paymentStatus === 'failed'
      ? '付款失敗'
      : source.paymentStatus === 'cancelled'
        ? '付款取消'
        : '尚未付款';
  return {
    id: `unpaid:${source.id}`,
    sourceKind: 'unpaid_refill',
    sourceId: source.id,
    transactionType: 'REFILL_FEE',
    occurredAt: source.createdAt,
    amount: toNtd(source.amount),
    paymentCollector: 'NONE',
    fundDirection: 'NO_SETTLEMENT',
    settlementStatus: 'EXCLUDED',
    relatedOrderId: source.id,
    relatedOrderDisplay: source.refillDisplay,
    storeId: source.storeId,
    customerId: source.customerId,
    customerName: source.customerName,
    content: `${source.customerName} 換罐`.trim(),
    remark,
    couponId: null,
    couponCode: null,
    jarSerial: source.jarSerial,
    searchText: buildSearchText([
      source.refillDisplay,
      source.id,
      source.customerName,
      source.jarSerial,
    ]),
  };
}

export type RewardRedemptionSource = {
  id: string;
  customerId: string;
  customerName: string;
  couponCode: string | null;
  discountAmount: number;
  storeId: string;
  usedAt: Date;
  settlementStatus?: SettlementStatus;
};

export function classifyCouponSubsidy(source: CouponSubsidySource): LedgerEntry {
  const amount = toNtd(source.discountAmount);
  return {
    id: `coupon:${source.id}`,
    sourceKind: 'coupon',
    sourceId: source.id,
    transactionType: 'COUPON_SUBSIDY',
    occurredAt: source.redeemedAt,
    amount,
    paymentCollector: 'NONE',
    fundDirection: 'FURMOSA_TO_STORE',
    settlementStatus: source.settlementStatus ?? 'UNSETTLED',
    relatedOrderId: source.relatedRefillOrderId,
    relatedOrderDisplay: source.relatedRefillDisplay ?? source.couponCode,
    storeId: source.storeId,
    customerId: source.customerId,
    customerName: source.customerName,
    content: `${source.customerName} 集點兌換`.trim(),
    remark: '集滿 10 點兌換優惠券，匠寵應補店家',
    couponId: source.couponId,
    couponCode: source.couponCode,
    jarSerial: null,
    searchText: buildSearchText([
      source.couponCode,
      source.relatedRefillOrderId,
      source.relatedRefillDisplay,
      source.customerName,
      source.customerId,
    ]),
  };
}

export function classifyRewardRedemption(source: RewardRedemptionSource): LedgerEntry {
  const amount = toNtd(source.discountAmount);
  const couponCode = source.couponCode?.trim() || null;
  return {
    id: `reward:${source.id}`,
    sourceKind: 'reward',
    sourceId: source.id,
    transactionType: 'COUPON_SUBSIDY',
    occurredAt: source.usedAt,
    amount,
    paymentCollector: 'NONE',
    fundDirection: 'FURMOSA_TO_STORE',
    settlementStatus: source.settlementStatus ?? 'UNSETTLED',
    relatedOrderId: null,
    relatedOrderDisplay: couponCode ?? source.id,
    storeId: source.storeId,
    customerId: source.customerId,
    customerName: source.customerName,
    content: `${source.customerName} 集點兌換`.trim(),
    remark: '集滿 10 點兌換優惠券，匠寵應補店家',
    couponId: null,
    couponCode,
    jarSerial: null,
    searchText: buildSearchText([couponCode, source.id, source.customerName, source.customerId]),
  };
}

export function classifyCouponReversal(source: CouponSubsidySource & { reversedAt: Date }): LedgerEntry {
  const base = classifyCouponSubsidy(source);
  return {
    ...base,
    id: `coupon-reversal:${source.id}`,
    transactionType: 'COUPON_REVERSAL',
    occurredAt: source.reversedAt,
    amount: toNtd(source.discountAmount),
    content: `${source.customerName} 優惠券補貼沖銷`.trim(),
    remark: '原優惠券補貼沖銷，不刪除原流水',
    searchText: `${base.searchText} 沖銷`,
  };
}

export function classifyRestockCost(source: RestockCostSource): LedgerEntry {
  return {
    id: `restock:${source.id}`,
    sourceKind: 'restock',
    sourceId: source.id,
    transactionType: 'RESTOCK_COST',
    occurredAt: source.occurredAt,
    amount: toNtd(source.amount),
    paymentCollector: 'NONE',
    fundDirection: 'STORE_TO_FURMOSA',
    settlementStatus: source.settlementStatus ?? 'UNSETTLED',
    relatedOrderId: source.relatedOrderId,
    relatedOrderDisplay: source.relatedOrderDisplay,
    storeId: source.storeId,
    customerId: null,
    customerName: '',
    content: source.content,
    remark: '店家進貨，應付匠寵',
    couponId: null,
    couponCode: null,
    jarSerial: null,
    searchText: buildSearchText([
      source.relatedOrderId,
      source.relatedOrderDisplay,
      source.content,
    ]),
  };
}

export function classifyAdjustment(source: AdjustmentSource): LedgerEntry {
  return {
    id: `adjustment:${source.id}`,
    sourceKind: 'adjustment',
    sourceId: source.id,
    transactionType: 'ADJUSTMENT',
    occurredAt: source.occurredAt,
    amount: toNtd(source.amount),
    paymentCollector: 'NONE',
    fundDirection: source.direction,
    settlementStatus: 'UNSETTLED',
    relatedOrderId: source.relatedOrderId,
    relatedOrderDisplay: source.relatedOrderDisplay,
    storeId: source.storeId,
    customerId: null,
    customerName: '',
    content: '其他調整',
    remark: `${source.reason}（${source.createdBy}）`,
    couponId: null,
    couponCode: null,
    jarSerial: null,
    searchText: buildSearchText([source.reason, source.createdBy, source.relatedOrderDisplay]),
  };
}

export function netSettlement(storeOwesFurmosa: number, furmosaOwesStore: number): NetSettlementResult {
  const netAmount = toNtd(storeOwesFurmosa) - toNtd(furmosaOwesStore);
  if (netAmount > 0) {
    return {
      netAmount,
      absoluteAmount: netAmount,
      payer: 'STORE',
      receiver: 'FURMOSA',
      resultLabel: '店家應匯給匠寵',
    };
  }
  if (netAmount < 0) {
    return {
      netAmount,
      absoluteAmount: Math.abs(netAmount),
      payer: 'FURMOSA',
      receiver: 'STORE',
      resultLabel: '匠寵應匯給店家',
    };
  }
  return {
    netAmount: 0,
    absoluteAmount: 0,
    payer: 'NONE',
    receiver: 'NONE',
    resultLabel: '本期無需付款',
  };
}

export function isIncludedInSettlement(entry: LedgerEntry): boolean {
  return (
    entry.settlementStatus === 'UNSETTLED' &&
    entry.fundDirection !== 'NO_SETTLEMENT' &&
    entry.amount !== 0
  );
}

export function summarizeStoreLedger(
  entries: LedgerEntry[],
  settledAmount = 0,
): StoreLedgerSummary {
  let restockCost = 0;
  let storeCollections = 0;
  let otherStorePayables = 0;
  let couponSubsidy = 0;
  let rebates = 0;
  let otherFurmosaPayables = 0;

  for (const entry of entries) {
    if (!isIncludedInSettlement(entry)) continue;
    const signed =
      entry.transactionType === 'COUPON_REVERSAL' ? -Math.abs(entry.amount) : Math.abs(entry.amount);

    if (entry.fundDirection === 'STORE_TO_FURMOSA') {
      if (entry.transactionType === 'RESTOCK_COST') restockCost += signed;
      else if (
        entry.transactionType === 'EMPTY_JAR_SURCHARGE' ||
        entry.transactionType === 'STORE_COLLECTION'
      ) {
        storeCollections += signed;
      } else {
        otherStorePayables += signed;
      }
    } else if (entry.fundDirection === 'FURMOSA_TO_STORE') {
      if (entry.transactionType === 'COUPON_SUBSIDY' || entry.transactionType === 'COUPON_REVERSAL') {
        couponSubsidy += signed;
      } else if (entry.transactionType === 'REBATE') {
        rebates += signed;
      } else {
        otherFurmosaPayables += signed;
      }
    }
  }

  const storeOwesFurmosa = toNtd(restockCost + storeCollections + otherStorePayables);
  const furmosaOwesStore = toNtd(couponSubsidy + rebates + otherFurmosaPayables);
  const net = netSettlement(storeOwesFurmosa, furmosaOwesStore);

  return {
    storeOwesFurmosa,
    furmosaOwesStore,
    settledAmount: toNtd(settledAmount),
    netAmount: net.netAmount,
    payer: net.payer,
    receiver: net.receiver,
    resultLabel: net.resultLabel,
    restockCost: toNtd(restockCost),
    storeCollections: toNtd(storeCollections),
    otherStorePayables: toNtd(otherStorePayables),
    couponSubsidy: toNtd(couponSubsidy),
    rebates: toNtd(rebates),
    otherFurmosaPayables: toNtd(otherFurmosaPayables),
  };
}

export function filterLedgerEntries(entries: LedgerEntry[], filter: LedgerFilter): LedgerEntry[] {
  const query = (filter.query ?? '').trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter.type && filter.type !== 'all' && entry.transactionType !== filter.type) return false;
    if (filter.status && filter.status !== 'all' && entry.settlementStatus !== filter.status) {
      return false;
    }
    if (filter.collector && filter.collector !== 'all' && entry.paymentCollector !== filter.collector) {
      return false;
    }
    if (query && !entry.searchText.includes(query)) return false;
    return true;
  });
}

export type RefillReconcileRow = {
  refillOrderId: string;
  refillDisplay: string;
  customerName: string;
  refillFee: number | null;
  refillFeeCollectorLabel: string | null;
  surcharge: number | null;
  surchargeCollectorLabel: string | null;
  coupon: number | null;
  couponDirectionLabel: string | null;
  storeCollected: number;
  furmosaSubsidy: number;
  settlementLabel: string;
  unpaid: boolean;
};

export function groupRefillReconciliations(entries: LedgerEntry[]): RefillReconcileRow[] {
  const byOrder = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    if (!entry.relatedOrderId) continue;
    if (
      entry.transactionType !== 'REFILL_FEE' &&
      entry.transactionType !== 'EMPTY_JAR_SURCHARGE' &&
      entry.transactionType !== 'COUPON_SUBSIDY' &&
      entry.transactionType !== 'STORE_COLLECTION'
    ) {
      continue;
    }
    const list = byOrder.get(entry.relatedOrderId) ?? [];
    list.push(entry);
    byOrder.set(entry.relatedOrderId, list);
  }

  return [...byOrder.entries()]
    .map(([refillOrderId, rows]) => {
      const refillFee = rows.find((row) => row.transactionType === 'REFILL_FEE');
      const surcharge = rows.find((row) => row.transactionType === 'EMPTY_JAR_SURCHARGE');
      const coupon = rows.find((row) => row.transactionType === 'COUPON_SUBSIDY');
      const unpaid = rows.some((row) => row.settlementStatus === 'EXCLUDED' && row.sourceKind === 'unpaid_refill');
      const storeCollected = rows
        .filter(
          (row) =>
            row.paymentCollector === 'STORE' &&
            row.settlementStatus === 'UNSETTLED' &&
            row.fundDirection === 'STORE_TO_FURMOSA',
        )
        .reduce((sum, row) => sum + row.amount, 0);
      const furmosaSubsidy = rows
        .filter((row) => row.transactionType === 'COUPON_SUBSIDY' && row.settlementStatus === 'UNSETTLED')
        .reduce((sum, row) => sum + row.amount, 0);
      const first = rows[0]!;
      return {
        refillOrderId,
        refillDisplay: first.relatedOrderDisplay,
        customerName: first.customerName,
        refillFee: refillFee && refillFee.settlementStatus !== 'EXCLUDED' ? refillFee.amount : refillFee?.amount ?? null,
        refillFeeCollectorLabel: refillFee ? paymentCollectorLabel(refillFee) : null,
        surcharge: surcharge?.amount ?? null,
        surchargeCollectorLabel: surcharge ? paymentCollectorLabel(surcharge) : null,
        coupon: coupon?.amount ?? null,
        couponDirectionLabel: coupon ? fundDirectionLabel(coupon) : null,
        storeCollected,
        furmosaSubsidy,
        settlementLabel: unpaid ? '尚未付款' : refillSettlementLabel(rows),
        unpaid,
      };
    })
    .sort((a, b) => a.refillDisplay.localeCompare(b.refillDisplay, 'zh-Hant'));
}

function refillSettlementLabel(rows: LedgerEntry[]): string {
  if (rows.some((row) => row.settlementStatus === 'EXCLUDED' && row.sourceKind === 'unpaid_refill')) {
    return '尚未付款';
  }
  if (rows.filter(isIncludedInSettlement).length === 0) {
    return '不列入店家應付';
  }
  if (rows.some((row) => row.settlementStatus === 'UNSETTLED' && row.fundDirection !== 'NO_SETTLEMENT')) {
    return '待結算';
  }
  if (rows.every((row) => row.settlementStatus === 'SETTLED' || row.fundDirection === 'NO_SETTLEMENT')) {
    return '已結清';
  }
  return '待結算';
}

export function txnTypeLabel(type: LedgerTxnType): string {
  switch (type) {
    case 'REFILL_FEE':
      return '換罐費';
    case 'EMPTY_JAR_SURCHARGE':
      return '補差額';
    case 'STORE_COLLECTION':
      return '店家代收';
    case 'COUPON_SUBSIDY':
      return '優惠券補貼';
    case 'COUPON_REVERSAL':
      return '優惠券補貼沖銷';
    case 'RESTOCK_COST':
      return '進貨款';
    case 'REBATE':
      return '活動返利';
    case 'ADJUSTMENT':
      return '其他調整';
  }
}

/** 交易流水表顯示用，比對帳內部名稱更接近店家說法 */
export function tableTypeLabel(type: LedgerTxnType): string {
  switch (type) {
    case 'REFILL_FEE':
      return '換罐費收入';
    case 'EMPTY_JAR_SURCHARGE':
      return '補差額代收';
    case 'STORE_COLLECTION':
      return '店家代收現金';
    default:
      return txnTypeLabel(type);
  }
}

export function paymentMethodLabel(entry: LedgerEntry): string {
  if (entry.transactionType === 'RESTOCK_COST') return '匠寵出貨';
  if (entry.transactionType === 'COUPON_SUBSIDY' || entry.transactionType === 'COUPON_REVERSAL') {
    return '匠寵補貼';
  }
  if (entry.transactionType === 'REBATE') return '匠寵補貼';
  if (entry.paymentCollector === 'STORE') return '店家代收現金';
  if (entry.paymentCollector === 'FURMOSA') return '客人線上付款';
  return '不需收款';
}

export function paymentCollectorLabel(entry: LedgerEntry): string {
  if (entry.paymentCollector === 'STORE') return '店家代收';
  if (entry.paymentCollector === 'FURMOSA') return '匠寵已收';
  if (entry.transactionType === 'COUPON_SUBSIDY') return '匠寵應補店家';
  return '不必收款';
}

export function fundDirectionLabel(entry: LedgerEntry): string {
  if (entry.settlementStatus === 'EXCLUDED' && entry.sourceKind === 'unpaid_refill') {
    return '尚未付款';
  }
  if (entry.fundDirection === 'NO_SETTLEMENT') return '匠寵已收';
  if (entry.fundDirection === 'STORE_TO_FURMOSA') {
    return entry.transactionType === 'RESTOCK_COST' ? '店家應付匠寵' : '待匯回匠寵';
  }
  return '匠寵應付店家';
}

export function settlementStatusLabel(entry: LedgerEntry): string {
  if (entry.settlementStatus === 'SETTLED') return '已結清';
  if (entry.settlementStatus === 'EXCLUDED') {
    if (entry.fundDirection === 'NO_SETTLEMENT' && entry.sourceKind === 'payment') {
      return entry.remark?.includes('尚未付款') || entry.remark?.includes('付款失敗')
        ? '暫不列入結算'
        : '已入帳';
    }
    return '暫不列入結算';
  }
  return '待結算';
}

export type LedgerEntryView = {
  id: string;
  occurredAt: string;
  typeLabel: string;
  content: string;
  amount: number;
  amountLabel: string;
  paymentMethodLabel: string;
  fundDirectionLabel: string;
  statusLabel: string;
  statusTone: 'settled' | 'pending' | 'alert' | 'neutral';
  relatedOrderDisplay: string;
  relatedOrderId: string | null;
  customerName: string;
  customerId: string | null;
  couponCode: string | null;
  couponId: string | null;
  remark: string | null;
  jarSerial: string | null;
  included: boolean;
  transactionType: LedgerTxnType;
  fundDirection: FundDirection;
  settlementStatus: SettlementStatus;
};

export function signedLedgerAmount(entry: Pick<LedgerEntry, 'amount' | 'transactionType'>): number {
  const abs = Math.abs(entry.amount);
  if (entry.transactionType === 'RESTOCK_COST' || entry.transactionType === 'COUPON_REVERSAL') {
    return -abs;
  }
  return abs;
}

export function toLedgerEntryView(entry: LedgerEntry): LedgerEntryView {
  const statusLabel = settlementStatusLabel(entry);
  const signed = signedLedgerAmount(entry);
  return {
    id: entry.id,
    occurredAt: entry.occurredAt.toISOString(),
    typeLabel: tableTypeLabel(entry.transactionType),
    content: entry.content,
    amount: entry.amount,
    amountLabel: `${signed < 0 ? '-' : '+'}${formatNtd(Math.abs(signed))}`,
    paymentMethodLabel: paymentMethodLabel(entry),
    fundDirectionLabel: fundDirectionLabel(entry),
    statusLabel,
    statusTone:
      statusLabel === '已結清' || statusLabel === '已入帳'
        ? 'settled'
        : statusLabel === '待結算' || statusLabel === '待回匠寵' || statusLabel === '待補給店家'
          ? 'pending'
          : statusLabel === '暫不列入結算' || statusLabel === '尚未付款'
            ? 'alert'
            : 'neutral',
    relatedOrderDisplay: entry.relatedOrderDisplay,
    relatedOrderId: entry.relatedOrderId,
    customerName: entry.customerName,
    customerId: entry.customerId,
    couponCode: entry.couponCode,
    couponId: entry.couponId,
    remark: entry.remark,
    jarSerial: entry.jarSerial,
    included: isIncludedInSettlement(entry),
    transactionType: entry.transactionType,
    fundDirection: entry.fundDirection,
    settlementStatus: entry.settlementStatus,
  };
}

export function formatNtd(amount: number, sign: 'auto' | 'negative' | 'none' = 'none'): string {
  const abs = Math.abs(toNtd(amount));
  const body = `NT$${new Intl.NumberFormat('zh-TW').format(abs)}`;
  if (sign === 'negative' || (sign === 'auto' && amount < 0)) return `-${body}`;
  return body;
}

export function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .toLowerCase();
}

export function sortLedgerEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => {
    const byTime = b.occurredAt.getTime() - a.occurredAt.getTime();
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
}
