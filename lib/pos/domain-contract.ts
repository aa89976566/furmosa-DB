/**
 * POS-01 Domain Contract — 可執行純函式。
 *
 * 本模組不得被 app／API／cron／既有 runtime 引用。
 * Production 行為必須零改變。
 *
 * 規格：docs/POS-01-DOMAIN-CONTRACT.md
 */

// ---------------------------------------------------------------------------
// 未決事項 — 不得猜測
// ---------------------------------------------------------------------------

export const POS_01_OPEN_DECISIONS = {
  refundRestockReason: {
    id: 'O1',
    status: 'UNDECIDED',
    note: '退款是否回庫、以及回庫原因尚未決定，不得猜測',
  },
  linePaymentReservationTimeout: {
    id: 'O2',
    status: 'UNDECIDED',
    note: 'LINE 付款 reservation timeout 尚未決定，不得硬編碼秒數或天數',
  },
  zhuwoOfficialImmutableIds: {
    id: 'O3',
    status: 'UNDECIDED',
    note: '豬窩三店正式 immutable IDs 尚未決定；禁止用中文店名辨識',
  },
} as const;

export const UNTRUSTED_CLIENT_FIELDS = [
  'merchantId',
  'price',
  'commission',
  'paymentStatus',
  'voucherAmount',
] as const;

export type UntrustedClientField = (typeof UNTRUSTED_CLIENT_FIELDS)[number];

export const PHASE_1_POS_ACCOUNT_POLICY = {
  activeAccountsPerPhysicalStore: 1,
  schemaMustNotForbidFutureMultiAccount: true,
} as const;

export const RESTOCK_MODEL = 'consignment' as const;

export const GROOMING_VOUCHER_POINTS = 10;
export const GROOMING_VOUCHER_VALIDITY_DAYS = 30;
export const GROOMING_VOUCHER_FACE_STANDARD_TWD = 200;
export const GROOMING_VOUCHER_FACE_ZHUWO_TWD = 250;

export const UNCOLLECTED_PICKUP_POLICY = {
  autoRefund: false,
  display: 'contact_support',
} as const;

// ---------------------------------------------------------------------------
// Canonical enums
// ---------------------------------------------------------------------------

export const COLLECTION_CHANNELS = [
  'merchant_collected',
  'furmosa_collected_line_ecpay',
] as const;
export type CollectionChannel = (typeof COLLECTION_CHANNELS)[number];

export const LEDGER_DIRECTIONS = ['merchant_owes_hq', 'hq_owes_merchant'] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_KINDS = [
  'ordinary_commission',
  'voucher_fixed_subsidy',
  'merchant_proposed_adjustment',
  'next_period_adjustment',
  'reversal',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const SALE_STATUSES = ['draft', 'completed', 'cancelled', 'reversed'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const REFUND_STATUSES = ['requested', 'approved', 'rejected', 'completed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const RESERVATION_STATUSES = ['reserved', 'consumed', 'released', 'expired'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESTOCK_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'converted_to_shipment',
  'cancelled',
] as const;
export type RestockRequestStatus = (typeof RESTOCK_REQUEST_STATUSES)[number];

export const RESTOCK_SHIPMENT_STATUSES = [
  'pending',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type RestockShipmentStatus = (typeof RESTOCK_SHIPMENT_STATUSES)[number];

export const VOUCHER_STATUSES = [
  'issued',
  'redeemed',
  'expired',
  'cancel_requested',
  'cancelled',
] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export const SETTLEMENT_STATUSES = ['draft', 'reviewing', 'approved', 'paid', 'cancelled'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const POS_ACTORS = ['merchant_staff', 'merchant_owner', 'hq'] as const;
export type PosActor = (typeof POS_ACTORS)[number];

export const GROOMING_VOUCHER_FACE_TIERS = ['standard_200', 'zhuwo_250'] as const;
export type GroomingVoucherFaceTier = (typeof GROOMING_VOUCHER_FACE_TIERS)[number];

export const COMPLETED_FACT_KINDS = ['sale', 'voucher_redemption', 'settlement'] as const;
export type CompletedFactKind = (typeof COMPLETED_FACT_KINDS)[number];

export type CorrectionMode = 'reversal' | 'next_period_adjustment';

// ---------------------------------------------------------------------------
// 狀態轉移 allow-list（from === to 視為重複，一律拒絕）
// ---------------------------------------------------------------------------

export const SALE_TRANSITIONS: Record<SaleStatus, readonly SaleStatus[]> = {
  draft: ['completed', 'cancelled'],
  completed: ['reversed'],
  cancelled: [],
  reversed: [],
};

export const REFUND_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
};

export const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  reserved: ['consumed', 'released', 'expired'],
  consumed: [],
  released: [],
  expired: [],
};

export const RESTOCK_REQUEST_TRANSITIONS: Record<
  RestockRequestStatus,
  readonly RestockRequestStatus[]
> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under_review', 'cancelled', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['converted_to_shipment', 'rejected'],
  rejected: [],
  converted_to_shipment: [],
  cancelled: [],
};

export const RESTOCK_SHIPMENT_TRANSITIONS: Record<
  RestockShipmentStatus,
  readonly RestockShipmentStatus[]
> = {
  pending: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const VOUCHER_TRANSITIONS: Record<VoucherStatus, readonly VoucherStatus[]> = {
  issued: ['redeemed', 'expired', 'cancel_requested'],
  redeemed: ['cancel_requested'],
  expired: [],
  cancel_requested: ['cancelled'],
  cancelled: [],
};

export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, readonly SettlementStatus[]> = {
  draft: ['reviewing', 'cancelled'],
  reviewing: ['approved', 'draft'],
  approved: ['paid'],
  paid: [],
  cancelled: [],
};

export function canTransition<S extends string>(
  allowList: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  if (from === to) return false;
  return (allowList[from] ?? []).includes(to);
}

export function assertTransition<S extends string>(
  allowList: Record<S, readonly S[]>,
  from: S,
  to: S,
  label: string,
): void {
  if (!canTransition(allowList, from, to)) {
    throw new Error(`${label}狀態不可由 ${from} 變更為 ${to}`);
  }
}

export const canTransitionSale = (from: SaleStatus, to: SaleStatus) =>
  canTransition(SALE_TRANSITIONS, from, to);
export const canTransitionRefund = (from: RefundStatus, to: RefundStatus) =>
  canTransition(REFUND_TRANSITIONS, from, to);
export const canTransitionReservation = (from: ReservationStatus, to: ReservationStatus) =>
  canTransition(RESERVATION_TRANSITIONS, from, to);
export const canTransitionRestockRequest = (from: RestockRequestStatus, to: RestockRequestStatus) =>
  canTransition(RESTOCK_REQUEST_TRANSITIONS, from, to);
export const canTransitionRestockShipment = (
  from: RestockShipmentStatus,
  to: RestockShipmentStatus,
) => canTransition(RESTOCK_SHIPMENT_TRANSITIONS, from, to);
export const canTransitionVoucher = (from: VoucherStatus, to: VoucherStatus) =>
  canTransition(VOUCHER_TRANSITIONS, from, to);
export const canTransitionSettlement = (from: SettlementStatus, to: SettlementStatus) =>
  canTransition(SETTLEMENT_TRANSITIONS, from, to);

// ---------------------------------------------------------------------------
// 金額：只接受整數台幣
// ---------------------------------------------------------------------------

export type TwdInteger = number;
export type IntegerPercent = number;

function isSafeIntegerNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertTwdInteger(value: unknown, label = '金額'): asserts value is TwdInteger {
  if (typeof value === 'number' && Number.isNaN(value)) {
    throw new Error(`${label}不可為 NaN`);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${label}不可為 Infinity`);
  }
  if (!isSafeIntegerNumber(value)) {
    throw new Error(`${label}必須是整數台幣，不可使用 Float 或非數字`);
  }
  if (value < 0) {
    throw new Error(`${label}不可為負值`);
  }
}

export function assertIntegerPercent(value: unknown, label = '佣金百分比'): asserts value is IntegerPercent {
  if (typeof value === 'number' && Number.isNaN(value)) {
    throw new Error(`${label}不可為 NaN`);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${label}不可為 Infinity`);
  }
  if (!isSafeIntegerNumber(value)) {
    throw new Error(`${label}必須是 0 到 100 的整數，不可使用 Float`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${label}必須介於 0 到 100`);
  }
}

/** 淨成交（已扣退款）× 店家百分比，四捨五入為整數台幣。 */
export function roundPercentCommission(netSalesTwd: unknown, percent: unknown): TwdInteger {
  assertTwdInteger(netSalesTwd, '淨成交額');
  assertIntegerPercent(percent);
  return Math.round((netSalesTwd * percent) / 100);
}

// ---------------------------------------------------------------------------
// 庫存
// ---------------------------------------------------------------------------

export function availableUnits(onHand: unknown, reserved: unknown): TwdInteger {
  assertTwdInteger(onHand, '在庫量');
  assertTwdInteger(reserved, '保留量');
  const available = onHand - reserved;
  if (available < 0) {
    throw new Error('可用庫存不可為負（嚴禁負庫存）');
  }
  return available;
}

export function assertCanTakeFromAvailable(
  onHand: unknown,
  reserved: unknown,
  qty: unknown,
  label = '數量',
): void {
  assertTwdInteger(qty, label);
  if (qty === 0) {
    throw new Error(`${label}必須大於 0`);
  }
  const available = availableUnits(onHand, reserved);
  if (qty > available) {
    throw new Error('可用庫存不足（嚴禁負庫存）');
  }
}

export function restockIncreasesStoreOnHand(status: RestockShipmentStatus): boolean {
  return status === 'delivered';
}

/** O1：退款不得自行決定是否回庫。 */
export function inventoryEffectOfRefund(): 'undecided' {
  return 'undecided';
}

// ---------------------------------------------------------------------------
// 帳務方向
// ---------------------------------------------------------------------------

export type OrdinarySaleLedger = {
  collectionChannel: CollectionChannel;
  kind: 'ordinary_commission';
  direction: LedgerDirection;
  netSalesTwd: TwdInteger;
  commissionTwd: TwdInteger;
  merchantOwesHqTwd: TwdInteger;
  hqOwesMerchantTwd: TwdInteger;
};

export type VoucherSubsidyLedger = {
  kind: 'voucher_fixed_subsidy';
  direction: 'hq_owes_merchant';
  voucherFaceTwd: TwdInteger;
  commissionTwd: 0;
  merchantOwesHqTwd: 0;
  hqOwesMerchantTwd: TwdInteger;
};

export function ordinarySaleLedger(
  collectionChannel: CollectionChannel,
  netSalesTwd: unknown,
  commissionPercent: unknown,
): OrdinarySaleLedger {
  const commissionTwd = roundPercentCommission(netSalesTwd, commissionPercent);
  assertTwdInteger(netSalesTwd, '淨成交額');

  if (collectionChannel === 'merchant_collected') {
    return {
      collectionChannel,
      kind: 'ordinary_commission',
      direction: 'merchant_owes_hq',
      netSalesTwd,
      commissionTwd,
      merchantOwesHqTwd: netSalesTwd - commissionTwd,
      hqOwesMerchantTwd: 0,
    };
  }

  return {
    collectionChannel,
    kind: 'ordinary_commission',
    direction: 'hq_owes_merchant',
    netSalesTwd,
    commissionTwd,
    merchantOwesHqTwd: 0,
    hqOwesMerchantTwd: commissionTwd,
  };
}

export function groomingVoucherFaceTwd(tier: GroomingVoucherFaceTier): TwdInteger {
  if (tier === 'zhuwo_250') return GROOMING_VOUCHER_FACE_ZHUWO_TWD;
  return GROOMING_VOUCHER_FACE_STANDARD_TWD;
}

export function assertServiceStrictlyExceedsVoucher(
  serviceTotalTwd: unknown,
  voucherFaceTwd: unknown,
): void {
  assertTwdInteger(serviceTotalTwd, '服務總額');
  assertTwdInteger(voucherFaceTwd, '券額');
  if (serviceTotalTwd <= voucherFaceTwd) {
    throw new Error('服務總額必須嚴格大於美容券面額');
  }
}

export function voucherRedemptionLedger(voucherFaceTwd: unknown): VoucherSubsidyLedger {
  assertTwdInteger(voucherFaceTwd, '券額');
  if (
    voucherFaceTwd !== GROOMING_VOUCHER_FACE_STANDARD_TWD &&
    voucherFaceTwd !== GROOMING_VOUCHER_FACE_ZHUWO_TWD
  ) {
    throw new Error('美容券面額只允許 200 或 250');
  }
  return {
    kind: 'voucher_fixed_subsidy',
    direction: 'hq_owes_merchant',
    voucherFaceTwd,
    commissionTwd: 0,
    merchantOwesHqTwd: 0,
    hqOwesMerchantTwd: voucherFaceTwd,
  };
}

export function expiredVoucherRefundsPoints(): false {
  return false;
}

// ---------------------------------------------------------------------------
// 結算鎖定與事實不可變
// ---------------------------------------------------------------------------

export function isSettlementLocked(status: SettlementStatus): boolean {
  return status === 'approved' || status === 'paid';
}

export function canRewriteSettlementFacts(status: SettlementStatus): boolean {
  return status === 'draft' || status === 'reviewing';
}

export function canReopenSettlement(_status: SettlementStatus): boolean {
  return false;
}

export function correctionForLockedSettlement(status: SettlementStatus): 'next_period_adjustment' {
  if (!isSettlementLocked(status)) {
    throw new Error('僅已核准或已撥款的結算使用次期 adjustment');
  }
  return 'next_period_adjustment';
}

export function correctionModeForCompletedFact(kind: CompletedFactKind): CorrectionMode {
  if (kind === 'settlement') return 'next_period_adjustment';
  return 'reversal';
}

export function assertCompletedFactImmutable(): never {
  throw new Error('完成交易、核銷、結算不可修改或刪除原事實，只能 reversal 或 adjustment');
}

export function uncollectedPickupAction(): typeof UNCOLLECTED_PICKUP_POLICY {
  return UNCOLLECTED_PICKUP_POLICY;
}

// ---------------------------------------------------------------------------
// 角色
// ---------------------------------------------------------------------------

export function canChangeCommissionRate(actor: PosActor): boolean {
  return actor === 'hq';
}

export function canMutateSettlement(actor: PosActor, status: SettlementStatus): boolean {
  return actor === 'hq' && canRewriteSettlementFacts(status);
}

export function canProposeExtraAdjustment(actor: PosActor): boolean {
  return actor === 'merchant_owner' || actor === 'hq';
}

export function canApproveAdjustment(actor: PosActor): boolean {
  return actor === 'hq';
}

export function canRequestVoucherCancel(actor: PosActor): boolean {
  return actor === 'merchant_staff' || actor === 'merchant_owner';
}

export function canApproveVoucherCancel(actor: PosActor): boolean {
  return actor === 'hq';
}

export function assertVoucherCancelByHq(actor: PosActor, from: VoucherStatus, to: VoucherStatus): void {
  assertTransition(VOUCHER_TRANSITIONS, from, to, '美容券');
  if (to === 'cancelled' && !canApproveVoucherCancel(actor)) {
    throw new Error('只有 HQ 才能核准取消美容券');
  }
}

// ---------------------------------------------------------------------------
// 不信任 client 財務欄位
// ---------------------------------------------------------------------------

export type ServerResolved<T> = T & { readonly source: 'server' };

export function requireServerResolved<T extends { source: 'server' }>(input: T): T {
  if (input.source !== 'server') {
    throw new Error('不信任 client 傳來的 merchantId／price／commission／paymentStatus／voucherAmount');
  }
  return input;
}

export function isUntrustedClientField(field: string): field is UntrustedClientField {
  return (UNTRUSTED_CLIENT_FIELDS as readonly string[]).includes(field);
}

