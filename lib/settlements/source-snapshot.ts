/**
 * 結算來源快照：來源分類、canonical key、精度與 legacy 欄位公式。
 *
 * 純函式模組，不連資料庫，可單元測試。寫入路徑見 lib/settlements/write-settlement.ts，
 * 讀取路徑見 lib/settlements/read-snapshot.ts。
 *
 * 凍結規格見 docs/reviews/pos-settlement-v1.md。核心不變條件：
 * - 只認已存在且可信的成交價，不以現價、成本、進貨價或 20%／30% 回推任何金額。
 * - 來源原值逐欄保留（例如 255 × 30% = 76.5 必須原樣存），不以容差抹掉半元。
 * - 加總一律走 Prisma.Decimal，只在最終淨額四捨五入一次（half-away-from-zero）。
 * - 缺價、歸屬不可靠或內部不一致的來源列為待確認：不計金額、不寫入、不占唯一鍵。
 *
 * 這裡的稽核鏡像保留 legacy Float 原值，不是 POS-01 的新佣金計算，
 * 因此不引用 TwdInteger 也不套用 roundPercentCommission。
 */

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

export const POS_SETTLEMENT_RULES_VERSION = 'pos-settlement-v1';

/** legacy Float 合計比較的唯一容差。新存的整數淨額必須完全相等，不得套用此值。 */
export const LEGACY_FLOAT_TOLERANCE = 0.01;

/** PostgreSQL INTEGER 範圍。新增的整數台幣欄位必須落在其中。 */
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;

export type SettlementSourceKind = 'consignment_sale' | 'store_collection' | 'coupon_subsidy';
export type SettlementSourceDirection = 'STORE_TO_FURMOSA' | 'FURMOSA_TO_STORE';

export type SettlementSourceDraft = {
  sourceKind: SettlementSourceKind;
  sourceKey: string;
  direction: SettlementSourceDirection;
  /** 來源原值。寄賣銷售放成交總額；代收放現金；券放面額。 */
  originalAmount: number;
  quantity: number | null;
  unitPrice: number | null;
  /** 寄賣銷售的已存分潤。同一列承載成交額與分潤，不拆成兩筆反向來源。 */
  commissionAmount: number | null;
  companyRevenue: number | null;
  occurredAt: Date;
  relatedOrderId: string | null;
  label: string;
  sourceSnapshot: Record<string, unknown>;
};

export type PendingSourceReason =
  | 'SALE_MISSING_PRICE'
  | 'SALE_COMPANY_REVENUE_MISMATCH'
  | 'STOCKTAKE_REDUCTION'
  | 'RESTOCK_NO_TRUSTED_PRICE'
  | 'COUPON_CODE_MISSING'
  | 'COUPON_STORE_AMBIGUOUS'
  | 'COUPON_SOURCE_CONFLICT'
  | 'UNSUPPORTED_LEDGER_AMOUNT';

const PENDING_REASON_LABEL: Record<PendingSourceReason, string> = {
  SALE_MISSING_PRICE: '這筆銷售沒有存成交價或分潤，需要人工確認後才能結算。',
  SALE_COMPANY_REVENUE_MISMATCH: '這筆銷售的公司實收與成交額減分潤不符，需要人工確認，系統不會自行更正。',
  STOCKTAKE_REDUCTION: '盤點減損沒有成交價，需要人工確認是否為銷售。',
  RESTOCK_NO_TRUSTED_PRICE: '進貨單沒有可信成交價，需要總部補價後才能結算。',
  COUPON_CODE_MISSING: '這張券沒有可靠券號，無法確認是否重複，需要人工確認。',
  COUPON_STORE_AMBIGUOUS: '這張券只能靠店名比對到本店，歸屬不可靠，需要人工確認。',
  COUPON_SOURCE_CONFLICT:
    '同一張券在兩個系統裡的面額或歸屬對不起來，需要人工確認，系統不會自行選一邊。',
  UNSUPPORTED_LEDGER_AMOUNT: '這筆金額目前沒有對應的結算欄位，需要人工確認。',
};

export type PendingSource = {
  reason: PendingSourceReason;
  reasonLabel: string;
  sourceKind: string;
  sourceRef: string;
  occurredAt: Date;
  label: string;
};

export function pendingSource(input: {
  reason: PendingSourceReason;
  sourceKind: string;
  sourceRef: string;
  occurredAt: Date;
  label: string;
}): PendingSource {
  return { ...input, reasonLabel: PENDING_REASON_LABEL[input.reason] };
}

// ---------------------------------------------------------------------------
// 精度
// ---------------------------------------------------------------------------

function decimal(value: number | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

/**
 * 唯一的進位點。half-away-from-zero：76.5 → 77，-76.5 → -77。
 *
 * 刻意不用 Math.round（Math.round(-76.5) === -76）也不用 Intl 的 halfExpand，
 * 兩者在負半元上的結果相反。
 */
export function halfAwayFromZero(value: number | Prisma.Decimal): number {
  const amount = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  if (!amount.isFinite()) throw new Error('金額必須是有限數值');
  const rounded = amount.abs().plus('0.5').floor();
  const signed = amount.isNegative() ? rounded.negated() : rounded;
  return signed.toNumber();
}

export function assertIntegerTwdRange(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} 必須是整數台幣`);
  if (value < INT4_MIN || value > INT4_MAX) throw new Error(`${label} 超出可儲存範圍`);
  return value;
}

export function withinLegacyTolerance(left: number, right: number): boolean {
  return Math.abs(left - right) <= LEGACY_FLOAT_TOLERANCE;
}

// ---------------------------------------------------------------------------
// canonical key
// ---------------------------------------------------------------------------

export function consignmentSaleSourceKey(txnId: string): string {
  return `consignment_sale:${txnId}`;
}

/** 由 canonical key 反解寄賣銷售流水 id；非寄賣銷售回傳 null。 */
export function consignmentSaleTxnIdFromKey(sourceKey: string): string | null {
  const prefix = 'consignment_sale:';
  if (!sourceKey.startsWith(prefix)) return null;
  const txnId = sourceKey.slice(prefix.length);
  return txnId.length > 0 ? txnId : null;
}

export function storeCollectionSourceKey(paymentId: string): string {
  return `store_collection:${paymentId}`;
}

/** 券以正規化券號為 canonical key，讓兩個來源模型能真正跨來源去重。 */
export function couponSourceKey(normalizedCode: string): string {
  return `coupon:${normalizedCode}`;
}

/** 券號缺失或空白時回傳 null。禁止以資料列 id 代替券號再宣稱已去重。 */
export function normalizeCouponCode(code: string | null | undefined): string | null {
  const value = (code ?? '').trim().toLowerCase();
  return value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// legacy 欄位公式
// ---------------------------------------------------------------------------

export type SettlementLegacyTotals = {
  /** G：寄賣銷售成交總額 */
  grossSales: number;
  /** C / G */
  commissionRate: number;
  /** C：已存分潤加總，不重算 */
  commissionAmount: number;
  /** R：核銷券補貼 */
  rewardPayout: number;
  /** S：POS v1 固定 0 */
  shippingFee: number;
  /** K：店家代收現金，不含寄賣銷售現金 */
  storeCollected: number;
  /** C + R + S */
  payable: number;
  /** G − C − R − S + K */
  merchantOwesUs: number;
  /** 唯一一次進位後的整數淨額 */
  netPayableTwd: number;
  direction: SettlementSourceDirection | 'NONE';
};

/**
 * 加總所需的最小欄位。`SettlementSourceDraft` 與資料庫讀出的來源列都滿足這個形狀，
 * 讓讀取與寫入共用同一個 Decimal 口徑（半元邊界下 JS 浮點累加會得出不同的整數淨額）。
 */
export type LegacySummableSource = {
  sourceKind: string;
  originalAmount: number;
  commissionAmount: number | null;
};

export function computeLegacyTotals(
  sources: readonly LegacySummableSource[],
  options: { shippingFee?: number } = {},
): SettlementLegacyTotals {
  let gross = new Prisma.Decimal(0);
  let commission = new Prisma.Decimal(0);
  let reward = new Prisma.Decimal(0);
  let collected = new Prisma.Decimal(0);
  const shipping = decimal(options.shippingFee);

  for (const source of sources) {
    if (source.sourceKind === 'consignment_sale') {
      gross = gross.plus(decimal(source.originalAmount));
      commission = commission.plus(decimal(source.commissionAmount));
    } else if (source.sourceKind === 'coupon_subsidy') {
      reward = reward.plus(decimal(source.originalAmount));
    } else {
      collected = collected.plus(decimal(source.originalAmount));
    }
  }

  const payable = commission.plus(reward).plus(shipping);
  const merchantOwesUs = gross.minus(commission).minus(reward).minus(shipping).plus(collected);
  const netPayableTwd = assertIntegerTwdRange(halfAwayFromZero(merchantOwesUs), '本期淨額');
  const storeCollected = assertIntegerTwdRange(halfAwayFromZero(collected), '店家代收現金');

  return {
    grossSales: gross.toNumber(),
    commissionRate: gross.isZero() ? 0 : commission.dividedBy(gross).toNumber(),
    commissionAmount: commission.toNumber(),
    rewardPayout: reward.toNumber(),
    shippingFee: shipping.toNumber(),
    storeCollected,
    payable: payable.toNumber(),
    merchantOwesUs: merchantOwesUs.toNumber(),
    netPayableTwd,
    direction: netPayableTwd > 0 ? 'STORE_TO_FURMOSA' : netPayableTwd < 0 ? 'FURMOSA_TO_STORE' : 'NONE',
  };
}

// ---------------------------------------------------------------------------
// 冪等 key 與 payload fingerprint
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function stable(value: number | null | undefined): string {
  return value == null ? 'null' : new Prisma.Decimal(value).toFixed();
}

/** 只含來源集合身分。來源集合相同但金額改變時，這個摘要不變。 */
export function sourceKeysDigest(sources: readonly SettlementSourceDraft[]): string {
  return sha256(
    sources
      .map((source) => source.sourceKey)
      .slice()
      .sort()
      .join('\n'),
  );
}

/**
 * 含每筆來源原值、方向與 legacy 合計。任何來源原值改變都必定改變這個摘要。
 *
 * 必須含 quantity 與 unitPrice：2 × 100 改成 4 × 50 時 originalAmount 不變，
 * 只看 originalAmount 會把來源原值變更誤判成同一個 payload。
 */
export function amountsDigest(
  sources: readonly SettlementSourceDraft[],
  totals: SettlementLegacyTotals,
): string {
  const rows = sources
    .map((source) =>
      [
        source.sourceKey,
        source.sourceKind,
        source.direction,
        stable(source.originalAmount),
        stable(source.quantity),
        stable(source.unitPrice),
        stable(source.commissionAmount),
        stable(source.companyRevenue),
        source.occurredAt.toISOString(),
      ].join('|'),
    )
    .slice()
    .sort();
  const totalsRow = [
    stable(totals.grossSales),
    stable(totals.commissionAmount),
    stable(totals.rewardPayout),
    stable(totals.shippingFee),
    stable(totals.storeCollected),
    stable(totals.merchantOwesUs),
    stable(totals.netPayableTwd),
  ].join('|');
  return sha256([...rows, totalsRow].join('\n'));
}

/**
 * 操作 key。
 *
 * `operationSeq` 是伺服器推導的操作序號（本來源集合在本店已作廢的嘗試次數），
 * 不可由瀏覽器提供。沒有它的話，撤回後同一組來源永遠命中原本那張 cancelled，
 * 店家再也無法重新結算。有了它：
 * - 同一次送出重送 → 序號未變 → 同一個 key → 回傳既有結算（冪等）
 * - 撤回後重新送出 → 序號 +1 → 新 key → 可以建立新結算
 * - 舊 key 重送 → 仍回到原本那張 cancelled，不復活
 */
export function buildIdempotencyKey(input: {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  sourceKeysDigest: string;
  intendedPaymentMethod: string;
  operationSeq: number;
}): string {
  if (!Number.isSafeInteger(input.operationSeq) || input.operationSeq < 0) {
    throw new Error('操作序號必須是非負整數');
  }
  return sha256(
    [
      POS_SETTLEMENT_RULES_VERSION,
      input.merchantId,
      input.periodStart.toISOString(),
      input.periodEnd.toISOString(),
      input.sourceKeysDigest,
      input.intendedPaymentMethod,
      String(input.operationSeq),
    ].join('|'),
  );
}

export function buildPayloadFingerprint(idempotencyKey: string, digest: string): string {
  return sha256(`${idempotencyKey}|${digest}`);
}

// ---------------------------------------------------------------------------
// 來源分類
// ---------------------------------------------------------------------------

export type ConsignmentSaleTxnInput = {
  id: string;
  txnNumber: string;
  type: string;
  quantity: number;
  unitPrice: number | null;
  commissionAmount: number | null;
  companyRevenue: number | null;
  orderId: string | null;
  orderNumber: string | null;
  productId: string;
  productName: string;
  createdAt: Date;
};

export type ClassifiedSource =
  | { kind: 'source'; source: SettlementSourceDraft }
  | { kind: 'pending'; pending: PendingSource };

/**
 * 寄賣銷售只認已存 unitPrice 與 commissionAmount 的 sale 流水。
 * 盤點減損（負數 adjust）永遠是待確認，因為沒有成交價。
 */
export function classifyConsignmentSaleTxn(txn: ConsignmentSaleTxnInput): ClassifiedSource {
  const quantity = Math.abs(txn.quantity);
  const reference = txn.orderNumber ?? txn.txnNumber;
  const label = `${txn.productName} × ${quantity}（${reference}）`;

  if (txn.type !== 'sale') {
    return {
      kind: 'pending',
      pending: pendingSource({
        reason: 'STOCKTAKE_REDUCTION',
        sourceKind: 'stocktake',
        sourceRef: txn.id,
        occurredAt: txn.createdAt,
        label,
      }),
    };
  }

  if (txn.unitPrice == null || txn.commissionAmount == null) {
    return {
      kind: 'pending',
      pending: pendingSource({
        reason: 'SALE_MISSING_PRICE',
        sourceKind: 'consignment_sale',
        sourceRef: txn.id,
        occurredAt: txn.createdAt,
        label,
      }),
    };
  }

  const gross = new Prisma.Decimal(quantity).times(new Prisma.Decimal(txn.unitPrice));
  const expectedCompanyRevenue = gross.minus(new Prisma.Decimal(txn.commissionAmount));

  if (
    txn.companyRevenue != null &&
    !withinLegacyTolerance(txn.companyRevenue, expectedCompanyRevenue.toNumber())
  ) {
    return {
      kind: 'pending',
      pending: pendingSource({
        reason: 'SALE_COMPANY_REVENUE_MISMATCH',
        sourceKind: 'consignment_sale',
        sourceRef: txn.id,
        occurredAt: txn.createdAt,
        label,
      }),
    };
  }

  return {
    kind: 'source',
    source: {
      sourceKind: 'consignment_sale',
      sourceKey: consignmentSaleSourceKey(txn.id),
      direction: 'STORE_TO_FURMOSA',
      originalAmount: gross.toNumber(),
      quantity,
      unitPrice: txn.unitPrice,
      commissionAmount: txn.commissionAmount,
      companyRevenue: txn.companyRevenue,
      occurredAt: txn.createdAt,
      relatedOrderId: txn.orderId,
      label,
      sourceSnapshot: {
        txnId: txn.id,
        txnNumber: txn.txnNumber,
        productId: txn.productId,
        productName: txn.productName,
        quantity,
        unitPrice: txn.unitPrice,
        commissionAmount: txn.commissionAmount,
        companyRevenue: txn.companyRevenue,
        orderId: txn.orderId,
        orderNumber: txn.orderNumber,
        createdAt: txn.createdAt.toISOString(),
      },
    },
  };
}

export type CouponSourceInput = {
  id: string;
  model: 'grooming_coupon' | 'reward_redemption';
  /** 原始券號。不可傳入資料列 id 充當券號。 */
  rawCouponCode: string | null;
  faceValue: number;
  redeemedAt: Date;
  /** 歸屬是否可靠。只靠中文店名比對時必須為 false。 */
  storeAttributionReliable: boolean;
  customerName: string;
  relatedOrderId: string | null;
};

export function classifyCouponSource(coupon: CouponSourceInput): ClassifiedSource {
  const label = `${coupon.customerName || '客人'} 集點兌換券${
    coupon.rawCouponCode ? ` ${coupon.rawCouponCode}` : ''
  }`;
  const normalized = normalizeCouponCode(coupon.rawCouponCode);

  if (!normalized) {
    return {
      kind: 'pending',
      pending: pendingSource({
        reason: 'COUPON_CODE_MISSING',
        sourceKind: coupon.model,
        sourceRef: coupon.id,
        occurredAt: coupon.redeemedAt,
        label,
      }),
    };
  }

  if (!coupon.storeAttributionReliable) {
    return {
      kind: 'pending',
      pending: pendingSource({
        reason: 'COUPON_STORE_AMBIGUOUS',
        sourceKind: coupon.model,
        sourceRef: coupon.id,
        occurredAt: coupon.redeemedAt,
        label,
      }),
    };
  }

  return {
    kind: 'source',
    source: {
      sourceKind: 'coupon_subsidy',
      sourceKey: couponSourceKey(normalized),
      direction: 'FURMOSA_TO_STORE',
      originalAmount: coupon.faceValue,
      quantity: null,
      unitPrice: null,
      commissionAmount: null,
      companyRevenue: null,
      occurredAt: coupon.redeemedAt,
      relatedOrderId: coupon.relatedOrderId,
      label,
      sourceSnapshot: {
        model: coupon.model,
        rowId: coupon.id,
        couponCode: coupon.rawCouponCode,
        normalizedCouponCode: normalized,
        faceValue: coupon.faceValue,
        redeemedAt: coupon.redeemedAt.toISOString(),
        customerName: coupon.customerName,
        relatedOrderId: coupon.relatedOrderId,
      },
    },
  };
}

export type StoreCollectionInput = {
  paymentId: string;
  amount: number;
  occurredAt: Date;
  relatedOrderId: string | null;
  label: string;
  snapshot: Record<string, unknown>;
};

export function storeCollectionSource(input: StoreCollectionInput): SettlementSourceDraft {
  return {
    sourceKind: 'store_collection',
    sourceKey: storeCollectionSourceKey(input.paymentId),
    direction: 'STORE_TO_FURMOSA',
    originalAmount: input.amount,
    quantity: null,
    unitPrice: null,
    commissionAmount: null,
    companyRevenue: null,
    occurredAt: input.occurredAt,
    relatedOrderId: input.relatedOrderId,
    label: input.label,
    sourceSnapshot: input.snapshot,
  };
}

export type DedupeResult = {
  sources: SettlementSourceDraft[];
  /** 無法安全去重的來源。兩邊都不認列，也不占唯一鍵。 */
  conflicts: PendingSource[];
};

/** 兩筆是否為同一張券的鏡像：面額與方向都相同才算。 */
function sameCouponValue(left: SettlementSourceDraft, right: SettlementSourceDraft): boolean {
  return (
    left.direction === right.direction &&
    new Prisma.Decimal(left.originalAmount).equals(new Prisma.Decimal(right.originalAmount))
  );
}

/**
 * 同一正規化券號在兩個來源模型同時出現時：
 * - 面額與方向完全一致（同一張券的鏡像）→ 只認列一次，以 GroomingCoupon 為準。
 * - 面額或歸屬衝突 → **兩邊都不認列**，產生待確認。系統不得自行選一邊把真實衝突解掉。
 *
 * 其餘 sourceKey 重複代表上游查詢有誤，視為程式錯誤而非資料歧義。
 */
export function dedupeSources(sources: readonly SettlementSourceDraft[]): DedupeResult {
  const byKey = new Map<string, SettlementSourceDraft>();
  const conflictKeys = new Map<string, SettlementSourceDraft>();

  for (const source of sources) {
    if (conflictKeys.has(source.sourceKey)) continue;

    const existing = byKey.get(source.sourceKey);
    if (!existing) {
      byKey.set(source.sourceKey, source);
      continue;
    }

    const isCouponPair =
      source.sourceKind === 'coupon_subsidy' && existing.sourceKind === 'coupon_subsidy';
    if (!isCouponPair) throw new Error(`來源鍵重複：${source.sourceKey}`);

    if (!sameCouponValue(existing, source)) {
      byKey.delete(source.sourceKey);
      conflictKeys.set(source.sourceKey, source);
      continue;
    }

    if (
      existing.sourceSnapshot.model !== 'grooming_coupon' &&
      source.sourceSnapshot.model === 'grooming_coupon'
    ) {
      byKey.set(source.sourceKey, source);
    }
  }

  return {
    sources: [...byKey.values()].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    conflicts: [...conflictKeys.values()].map((source) =>
      pendingSource({
        reason: 'COUPON_SOURCE_CONFLICT',
        sourceKind: source.sourceKind,
        sourceRef: source.sourceKey,
        occurredAt: source.occurredAt,
        label: source.label,
      }),
    ),
  };
}
