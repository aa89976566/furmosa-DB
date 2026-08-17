/**
 * POS-01 Domain Contract — 可落 DB 的不變量與純決策。
 * 不得被 app／API／cron／既有 runtime 引用。Production 行為零改變。
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
  zhuwoOfficialImmutableIds: {
    id: 'O3',
    status: 'UNDECIDED',
    note: '豬窩三店正式 immutable IDs 尚未決定；禁止用中文店名辨識',
  },
} as const;

export const PHASE_1_POS_ACCOUNT_POLICY = {
  activeAccountsPerPhysicalStore: 1,
  schemaMustNotForbidFutureMultiAccount: true,
} as const;

export const RESTOCK_MODEL = 'consignment' as const;

export const GROOMING_VOUCHER_POINTS = 10;
export const GROOMING_VOUCHER_VALIDITY_DAYS = 30;
export const GROOMING_VOUCHER_TIME_ZONE = 'Asia/Taipei';
export const GROOMING_VOUCHER_FACE_STANDARD_TWD = 200;
export const GROOMING_VOUCHER_FACE_ZHUWO_TWD = 250;

export const UNPAID_PAYMENT_INTENT_TTL_HOURS = 24;
export const UNPAID_PAYMENT_INTENT_TTL_MS = UNPAID_PAYMENT_INTENT_TTL_HOURS * 60 * 60 * 1000;

export const UNCOLLECTED_PICKUP_POLICY = {
  autoRefund: false,
  autoExpire: false,
  autoRelease: false,
  display: 'contact_support',
} as const;

export type UntrustedClientRefundInput = {
  actualUnitPriceTwd?: unknown;
  requestedQuantity?: unknown;
  requestedAmountTwd?: unknown;
};

export const SERVER_MUST_RESOLVE_FIELDS = [
  'merchantId',
  'productId',
  'inventory',
  'originalSale',
  'collectionChannel',
  'commission',
  'commissionRate',
  'commissionAmount',
  'direction',
  'ledgerKind',
  'paymentStatus',
  'voucherAmount',
  'voucherTier',
  'voucherFaceTwd',
  'settlementStatus',
  'settlementRouting',
  'refundRemainder',
  'commissionReversalSnapshot',
  'inventoryAggregateId',
] as const;

export const CLIENT_MAY_SUBMIT_BUSINESS_INPUT = [
  'actualUnitPriceTwd',
  'requestedQuantity',
  'requestedAmountTwd',
] as const;

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

export const ADJUSTMENT_KINDS = [
  'merchant_proposed_adjustment',
  'next_period_adjustment',
] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const SALE_STATUSES = ['draft', 'completed', 'cancelled'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_REVERSAL_PROJECTIONS = [
  'not_reversed',
  'partially_reversed',
  'fully_reversed',
] as const;
export type SaleReversalProjection = (typeof SALE_REVERSAL_PROJECTIONS)[number];

export const REFUND_STATUSES = ['requested', 'approved', 'rejected', 'completed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const RESERVATION_STATUSES = ['reserved', 'consumed', 'released', 'expired'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  'pending_payment',
  'paid_reserved',
  'ready_for_pickup',
  'picked_up',
  'expired',
  'cancelled',
  'refund_pending',
  'refunded',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

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
  'available',
  'redeemed',
  'expired',
  'cancelled',
] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export const CANCELLATION_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type CancellationRequestStatus = (typeof CANCELLATION_REQUEST_STATUSES)[number];

export const SETTLEMENT_STATUSES = ['draft', 'reviewing', 'approved', 'paid', 'cancelled'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const POS_ACTORS = ['merchant_staff', 'merchant_owner', 'hq'] as const;
export type PosActor = (typeof POS_ACTORS)[number];

export const GROOMING_VOUCHER_FACE_TIERS = ['standard_200', 'zhuwo_250'] as const;
export type GroomingVoucherFaceTier = (typeof GROOMING_VOUCHER_FACE_TIERS)[number];

export const COMPLETED_FACT_KINDS = ['sale', 'voucher_redemption', 'settlement'] as const;
export type CompletedFactKind = (typeof COMPLETED_FACT_KINDS)[number];

export type CorrectionMode = 'reversal' | 'next_period_adjustment';

export const INVENTORY_OP_KINDS = [
  'reserve',
  'release',
  'expire',
  'consume_pickup',
  'consume_in_store',
] as const;
export type InventoryOpKind = (typeof INVENTORY_OP_KINDS)[number];

export const SETTLEMENT_DRAFT_METADATA_FIELDS = [
  'note',
  'periodStart',
  'periodEnd',
  'reviewerComment',
] as const;

export const SETTLEMENT_LOCKED_FACT_FIELDS = [
  'lines',
  'amounts',
  'grossSales',
  'commissionAmount',
  'payable',
] as const;

// ---------------------------------------------------------------------------
// Runtime allow-list — 未知／大小寫不符一律 throw
// ---------------------------------------------------------------------------

function parseAllowListValue<T extends string>(
  value: unknown,
  list: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !(list as readonly string[]).includes(value)) {
    throw new Error(`${label}不在 allow-list，未知或大小寫不符`);
  }
  return value as T;
}

export function parseCollectionChannel(value: unknown): CollectionChannel {
  return parseAllowListValue(value, COLLECTION_CHANNELS, '收款通道');
}
export function parseLedgerDirection(value: unknown): LedgerDirection {
  return parseAllowListValue(value, LEDGER_DIRECTIONS, '帳本方向');
}
export function parseLedgerKind(value: unknown): LedgerKind {
  return parseAllowListValue(value, LEDGER_KINDS, '帳本種類');
}
export function parseAdjustmentKind(value: unknown): AdjustmentKind {
  return parseAllowListValue(value, ADJUSTMENT_KINDS, '加減款種類');
}
export function parseSaleStatus(value: unknown): SaleStatus {
  return parseAllowListValue(value, SALE_STATUSES, '銷售狀態');
}
export function parseRefundStatus(value: unknown): RefundStatus {
  return parseAllowListValue(value, REFUND_STATUSES, '退款狀態');
}
export function parseReservationStatus(value: unknown): ReservationStatus {
  return parseAllowListValue(value, RESERVATION_STATUSES, '保留狀態');
}
export function parseFulfillmentStatus(value: unknown): FulfillmentStatus {
  return parseAllowListValue(value, FULFILLMENT_STATUSES, '履約狀態');
}
export function parseRestockRequestStatus(value: unknown): RestockRequestStatus {
  return parseAllowListValue(value, RESTOCK_REQUEST_STATUSES, '補貨申請狀態');
}
export function parseRestockShipmentStatus(value: unknown): RestockShipmentStatus {
  return parseAllowListValue(value, RESTOCK_SHIPMENT_STATUSES, '補貨出貨狀態');
}
export function parseVoucherStatus(value: unknown): VoucherStatus {
  return parseAllowListValue(value, VOUCHER_STATUSES, '美容券狀態');
}
export function parseCancellationRequestStatus(value: unknown): CancellationRequestStatus {
  return parseAllowListValue(value, CANCELLATION_REQUEST_STATUSES, '取消申請狀態');
}
export function parseSettlementStatus(value: unknown): SettlementStatus {
  return parseAllowListValue(value, SETTLEMENT_STATUSES, '結算狀態');
}
export function parsePosActor(value: unknown): PosActor {
  return parseAllowListValue(value, POS_ACTORS, '角色');
}
export function parseVoucherTier(value: unknown): GroomingVoucherFaceTier {
  return parseAllowListValue(value, GROOMING_VOUCHER_FACE_TIERS, '美容券面額層級');
}
export function parseInventoryOpKind(value: unknown): InventoryOpKind {
  return parseAllowListValue(value, INVENTORY_OP_KINDS, '庫存操作');
}

// ---------------------------------------------------------------------------
// 狀態轉移
// ---------------------------------------------------------------------------

export const SALE_TRANSITIONS: Record<SaleStatus, readonly SaleStatus[]> = {
  draft: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
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

export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  pending_payment: ['paid_reserved', 'expired', 'cancelled'],
  paid_reserved: ['ready_for_pickup', 'refund_pending'],
  ready_for_pickup: ['picked_up', 'refund_pending'],
  picked_up: [],
  expired: [],
  cancelled: [],
  refund_pending: ['refunded'],
  refunded: [],
};

export const RESTOCK_REQUEST_TRANSITIONS: Record<
  RestockRequestStatus,
  readonly RestockRequestStatus[]
> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under_review', 'cancelled', 'rejected'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['converted_to_shipment'],
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
  issued: ['available', 'redeemed', 'expired'],
  available: ['redeemed', 'expired'],
  redeemed: ['cancelled'],
  expired: [],
  cancelled: [],
};

export const CANCELLATION_REQUEST_TRANSITIONS: Record<
  CancellationRequestStatus,
  readonly CancellationRequestStatus[]
> = {
  pending: ['approved', 'rejected'],
  approved: [],
  rejected: [],
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
  from: unknown,
  to: unknown,
): boolean {
  const keys = Object.keys(allowList) as S[];
  const parsedFrom = parseAllowListValue(from, keys, '狀態');
  const parsedTo = parseAllowListValue(to, keys, '狀態');
  if (parsedFrom === parsedTo) return false;
  return allowList[parsedFrom].includes(parsedTo);
}

export function assertTransition<S extends string>(
  allowList: Record<S, readonly S[]>,
  from: unknown,
  to: unknown,
  label: string,
): void {
  if (!canTransition(allowList, from, to)) {
    throw new Error(`${label}狀態不可由 ${String(from)} 變更為 ${String(to)}`);
  }
}

export const canTransitionSale = (from: unknown, to: unknown) =>
  canTransition(SALE_TRANSITIONS, from, to);
export const canTransitionRefund = (from: unknown, to: unknown) =>
  canTransition(REFUND_TRANSITIONS, from, to);
export const canTransitionReservation = (from: unknown, to: unknown) =>
  canTransition(RESERVATION_TRANSITIONS, from, to);
export const canTransitionFulfillment = (from: unknown, to: unknown) =>
  canTransition(FULFILLMENT_TRANSITIONS, from, to);
export const canTransitionRestockRequest = (from: unknown, to: unknown) =>
  canTransition(RESTOCK_REQUEST_TRANSITIONS, from, to);
export const canTransitionRestockShipment = (from: unknown, to: unknown) =>
  canTransition(RESTOCK_SHIPMENT_TRANSITIONS, from, to);
export const canTransitionVoucher = (from: unknown, to: unknown) =>
  canTransition(VOUCHER_TRANSITIONS, from, to);
export const canTransitionCancellationRequest = (from: unknown, to: unknown) =>
  canTransition(CANCELLATION_REQUEST_TRANSITIONS, from, to);
export const canTransitionSettlement = (from: unknown, to: unknown) =>
  canTransition(SETTLEMENT_TRANSITIONS, from, to);

// ---------------------------------------------------------------------------
// 金額／件數／日期
// ---------------------------------------------------------------------------

export type TwdInteger = number;
export type NonNegativeIntegerUnits = number;
export type IntegerPercent = number;

function isSafeIntegerNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function assertSafeIntegerCore(value: unknown, label: string): asserts value is number {
  if (typeof value === 'number' && Number.isNaN(value)) {
    throw new Error(`${label}不可為 NaN`);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${label}不可為 Infinity`);
  }
  if (!isSafeIntegerNumber(value)) {
    throw new Error(`${label}必須是安全整數，不可使用 Float 或非數字`);
  }
}

export function assertTwdInteger(value: unknown, label = '金額'): asserts value is TwdInteger {
  assertSafeIntegerCore(value, label);
  if (value < 0) {
    throw new Error(`${label}不可為負值`);
  }
}

export function assertPositiveTwdInteger(
  value: unknown,
  label = '金額',
): asserts value is TwdInteger {
  assertTwdInteger(value, label);
  if (value === 0) {
    throw new Error(`${label}必須大於 0`);
  }
}

export function assertRequiredContractText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}不可為空`);
  }
  return value;
}

export function assertNonNegativeIntegerUnits(
  value: unknown,
  label = '數量',
): asserts value is NonNegativeIntegerUnits {
  assertSafeIntegerCore(value, label);
  if (value < 0) {
    throw new Error(`${label}不可為負值`);
  }
}

export function assertIntegerPercent(
  value: unknown,
  label = '佣金百分比',
): asserts value is IntegerPercent {
  assertSafeIntegerCore(value, label);
  if (value < 0 || value > 100) {
    throw new Error(`${label}必須介於 0 到 100`);
  }
}

export function safeIntegerAdd(a: number, b: number, label = '金額'): number {
  assertSafeIntegerCore(a, label);
  assertSafeIntegerCore(b, label);
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new Error(`${label}加總超出安全整數`);
  }
  return sum;
}

export function safeIntegerMul(a: number, b: number, label = '金額'): number {
  assertSafeIntegerCore(a, label);
  assertSafeIntegerCore(b, label);
  if (a === 0 || b === 0) return 0;
  if (Math.abs(a) > Number.MAX_SAFE_INTEGER / Math.abs(b)) {
    throw new Error(`${label}乘法超出安全整數`);
  }
  const product = a * b;
  if (!Number.isSafeInteger(product)) {
    throw new Error(`${label}乘法超出安全整數`);
  }
  return product;
}

export function roundPercentCommission(actualGrossTwd: unknown, percent: unknown): TwdInteger {
  assertTwdInteger(actualGrossTwd, '實際成交額');
  assertIntegerPercent(percent);
  const product = safeIntegerMul(actualGrossTwd, percent, '佣金');
  const rounded = Math.round(product / 100);
  if (!Number.isSafeInteger(rounded) || rounded < 0) {
    throw new Error('佣金結果超出安全整數');
  }
  return rounded;
}

export function assertValidDate(value: unknown, label = '日期'): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label}不是有效日期`);
  }
}

export function assertValidPeriod(start: unknown, end: unknown): { start: Date; end: Date } {
  assertValidDate(start, '期間起日');
  assertValidDate(end, '期間迄日');
  if (!(start < end)) {
    throw new Error('期間起日必須早於迄日');
  }
  return { start, end };
}

export type SaleLineCommissionSnapshot = {
  actualGrossTwd: TwdInteger;
  commissionRateSnapshot: IntegerPercent;
  commissionAmountSnapshot: TwdInteger;
};

export function snapshotCompletedSaleLine(
  actualGrossTwd: unknown,
  commissionPercent: unknown,
): SaleLineCommissionSnapshot {
  const commissionAmountSnapshot = roundPercentCommission(actualGrossTwd, commissionPercent);
  assertTwdInteger(actualGrossTwd, '實際成交額');
  assertIntegerPercent(commissionPercent);
  return {
    actualGrossTwd,
    commissionRateSnapshot: commissionPercent,
    commissionAmountSnapshot,
  };
}

export function sumSettlementCommissionSnapshots(
  snapshots: readonly Pick<SaleLineCommissionSnapshot, 'commissionAmountSnapshot'>[],
): TwdInteger {
  let total = 0;
  for (const row of snapshots) {
    assertTwdInteger(row.commissionAmountSnapshot, 'snapshot 佣金');
    total = safeIntegerAdd(total, row.commissionAmountSnapshot, '結算加總');
  }
  return total;
}

// ---------------------------------------------------------------------------
// 庫存 — key→{fingerprint,result}，不是 Set<string>
// ---------------------------------------------------------------------------

export type InventoryState = {
  onHand: NonNegativeIntegerUnits;
  reserved: NonNegativeIntegerUnits;
};

export type InventoryOp = {
  /** Server 已解析的權威聚合身分，至少為 merchantStockId；不可信任 client 值。 */
  inventoryAggregateId: string;
  op: unknown;
  qty: unknown;
  idempotencyKey: string;
  reference?: string;
};

export type InventoryIdempotencyRecord = {
  fingerprint: string;
  result: InventoryState;
};

export type InventoryIdempotencyLog = ReadonlyMap<string, InventoryIdempotencyRecord>;

export function availableUnits(onHand: unknown, reserved: unknown): NonNegativeIntegerUnits {
  assertNonNegativeIntegerUnits(onHand, '在庫量');
  assertNonNegativeIntegerUnits(reserved, '保留量');
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
  assertNonNegativeIntegerUnits(qty, label);
  if (qty === 0) {
    throw new Error(`${label}必須大於 0`);
  }
  const available = availableUnits(onHand, reserved);
  if (qty > available) {
    throw new Error('可用庫存不足（嚴禁負庫存）');
  }
}

function assertPositiveUnits(qty: unknown, label = '數量'): NonNegativeIntegerUnits {
  assertNonNegativeIntegerUnits(qty, label);
  if (qty === 0) {
    throw new Error(`${label}必須大於 0`);
  }
  return qty;
}

export function inventoryOpFingerprint(input: {
  inventoryAggregateId: string;
  op: InventoryOpKind;
  qty: NonNegativeIntegerUnits;
  reference?: string;
}): string {
  return [
    input.inventoryAggregateId,
    input.op,
    String(input.qty),
    input.reference ?? '',
  ].join('|');
}

export function applyInventoryOp(
  state: InventoryState,
  op: InventoryOp,
  log: InventoryIdempotencyLog,
): { state: InventoryState; log: Map<string, InventoryIdempotencyRecord>; duplicate: boolean } {
  const idempotencyKey = assertRequiredContractText(op.idempotencyKey, 'idempotencyKey');
  const inventoryAggregateId = assertRequiredContractText(
    op.inventoryAggregateId,
    'inventoryAggregateId',
  );
  const kind = parseInventoryOpKind(op.op);
  const qty = assertPositiveUnits(op.qty);
  const reference =
    op.reference == null || op.reference === ''
      ? undefined
      : assertRequiredContractText(op.reference, 'inventory reference');
  assertNonNegativeIntegerUnits(state.onHand, '在庫量');
  assertNonNegativeIntegerUnits(state.reserved, '保留量');
  const fingerprint = inventoryOpFingerprint({
    inventoryAggregateId,
    op: kind,
    qty,
    reference,
  });
  const existing = log.get(idempotencyKey);
  const nextLog = new Map(log);

  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new Error('同一 idempotencyKey 不可對應不同庫存聚合、操作或數量');
    }
    return { state: existing.result, log: nextLog, duplicate: true };
  }

  let next: InventoryState;
  if (kind === 'reserve') {
    assertCanTakeFromAvailable(state.onHand, state.reserved, qty);
    next = { onHand: state.onHand, reserved: safeIntegerAdd(state.reserved, qty, '保留量') };
  } else if (kind === 'release' || kind === 'expire') {
    if (qty > state.reserved) {
      throw new Error('釋放量不可超過已保留量');
    }
    next = { onHand: state.onHand, reserved: state.reserved - qty };
  } else if (kind === 'consume_pickup') {
    if (qty > state.reserved) {
      throw new Error('取貨量不可超過已保留量');
    }
    if (qty > state.onHand) {
      throw new Error('可用庫存不足（嚴禁負庫存）');
    }
    next = { onHand: state.onHand - qty, reserved: state.reserved - qty };
  } else if (kind === 'consume_in_store') {
    assertCanTakeFromAvailable(state.onHand, state.reserved, qty);
    next = { onHand: state.onHand - qty, reserved: state.reserved };
  } else {
    throw new Error('庫存操作不在 allow-list，未知或大小寫不符');
  }

  if (next.onHand < 0 || next.reserved < 0 || next.onHand - next.reserved < 0) {
    throw new Error('可用庫存不可為負（嚴禁負庫存）');
  }
  nextLog.set(idempotencyKey, { fingerprint, result: next });
  return { state: next, log: nextLog, duplicate: false };
}

export function restockIncreasesStoreOnHand(status: unknown): boolean {
  return parseRestockShipmentStatus(status) === 'delivered';
}

export function inventoryEffectOfRefund(): 'undecided' {
  return 'undecided';
}

export function fulfillmentInventoryOp(
  from: unknown,
  to: unknown,
): InventoryOpKind | null {
  assertTransition(FULFILLMENT_TRANSITIONS, from, to, '履約');
  const parsedFrom = parseFulfillmentStatus(from);
  const parsedTo = parseFulfillmentStatus(to);
  if (parsedFrom === 'pending_payment' && parsedTo === 'paid_reserved') return 'reserve';
  if (parsedFrom === 'ready_for_pickup' && parsedTo === 'picked_up') return 'consume_pickup';
  if (
    parsedTo === 'refund_pending' &&
    (parsedFrom === 'paid_reserved' || parsedFrom === 'ready_for_pickup')
  ) {
    return 'release';
  }
  return null;
}

// ---------------------------------------------------------------------------
// 未付款 24h vs 已付款不自動失效
// ---------------------------------------------------------------------------

export function unpaidCheckoutReservesInventory(): false {
  return false;
}

export function paidReservationAutoExpires(): false {
  return false;
}

export function paidReservationAutoRefunds(): false {
  return false;
}

export function paidReservationAutoReleases(): false {
  return false;
}

export function isUnpaidPaymentIntentExpired(createdAt: unknown, now: unknown): boolean {
  assertValidDate(createdAt, '建立時間');
  assertValidDate(now, '現在時間');
  return now.getTime() - createdAt.getTime() >= UNPAID_PAYMENT_INTENT_TTL_MS;
}

export function decideUnpaidPaymentExpiry(
  status: unknown,
  createdAt: unknown,
  now: unknown,
): 'expire' | 'keep' {
  const parsed = parseFulfillmentStatus(status);
  if (parsed !== 'pending_payment') {
    throw new Error('只有未付款 checkout 適用 24 小時失效');
  }
  return isUnpaidPaymentIntentExpired(createdAt, now) ? 'expire' : 'keep';
}

export function paidPickupOverdueAction(status: unknown): 'contact_support' {
  const parsed = parseFulfillmentStatus(status);
  if (parsed !== 'paid_reserved' && parsed !== 'ready_for_pickup') {
    throw new Error('逾期未領客服規則只適用已付款待取');
  }
  return UNCOLLECTED_PICKUP_POLICY.display;
}

// ---------------------------------------------------------------------------
// 銷售 snapshot、部分退款
// ---------------------------------------------------------------------------

export type CompletedSaleLine = {
  id: string;
  status: 'completed';
  actualGrossTwd: TwdInteger;
  quantity?: NonNegativeIntegerUnits;
  collectionChannel: CollectionChannel;
  commissionRateSnapshot: IntegerPercent;
  commissionAmountSnapshot: TwdInteger;
  settlementStatus: SettlementStatus | null;
};

export type RefundReversalLine = {
  originalSaleId: string;
  amountTwd: TwdInteger;
  quantity?: NonNegativeIntegerUnits;
  originalCollectionChannel: CollectionChannel;
  originalCommissionRateSnapshot: IntegerPercent;
  commissionReversalSnapshot: TwdInteger;
  idempotencyKey: string;
};

export type OrdinarySaleLedger = {
  collectionChannel: CollectionChannel;
  kind: 'ordinary_commission';
  direction: LedgerDirection;
  netSalesTwd: TwdInteger;
  commissionTwd: TwdInteger;
  merchantOwesHqTwd: TwdInteger;
  hqOwesMerchantTwd: TwdInteger;
};

export type RefundReversalLedger = {
  originalSaleId: string;
  kind: 'reversal' | 'next_period_adjustment';
  direction: LedgerDirection;
  refundAmountTwd: TwdInteger;
  commissionTwd: TwdInteger;
  merchantOwesHqTwd: TwdInteger;
  hqOwesMerchantTwd: TwdInteger;
  settlementDestination: 'current_open_period' | 'next_period_adjustment';
};

export function assertOriginalSaleImmutable(sale: CompletedSaleLine): void {
  if (sale.status !== 'completed') {
    throw new Error('原 sale 必須保持 completed');
  }
}

export function assertSaleCommissionSnapshotConsistent(sale: CompletedSaleLine): void {
  assertOriginalSaleImmutable(sale);
  parseCollectionChannel(sale.collectionChannel);
  assertTwdInteger(sale.actualGrossTwd, '實際成交額');
  assertIntegerPercent(sale.commissionRateSnapshot);
  assertTwdInteger(sale.commissionAmountSnapshot, '佣金 snapshot');
  const expected = roundPercentCommission(sale.actualGrossTwd, sale.commissionRateSnapshot);
  if (expected !== sale.commissionAmountSnapshot) {
    throw new Error('原 sale 佣金 snapshot 與成交額／費率不一致');
  }
}

export function ordinarySaleLedger(
  collectionChannel: unknown,
  actualGrossTwd: unknown,
  commissionPercent: unknown,
): OrdinarySaleLedger {
  const channel = parseCollectionChannel(collectionChannel);
  const snapshot = snapshotCompletedSaleLine(actualGrossTwd, commissionPercent);

  if (channel === 'merchant_collected') {
    return {
      collectionChannel: channel,
      kind: 'ordinary_commission',
      direction: 'merchant_owes_hq',
      netSalesTwd: snapshot.actualGrossTwd,
      commissionTwd: snapshot.commissionAmountSnapshot,
      merchantOwesHqTwd: snapshot.actualGrossTwd - snapshot.commissionAmountSnapshot,
      hqOwesMerchantTwd: 0,
    };
  }

  return {
    collectionChannel: channel,
    kind: 'ordinary_commission',
    direction: 'hq_owes_merchant',
    netSalesTwd: snapshot.actualGrossTwd,
    commissionTwd: snapshot.commissionAmountSnapshot,
    merchantOwesHqTwd: 0,
    hqOwesMerchantTwd: snapshot.commissionAmountSnapshot,
  };
}

export function refundFingerprint(input: {
  originalSaleId: string;
  amountTwd: TwdInteger;
  quantity?: NonNegativeIntegerUnits;
  originalCollectionChannel: CollectionChannel;
  originalCommissionRateSnapshot: IntegerPercent;
}): string {
  const qty = input.quantity == null ? '' : String(input.quantity);
  return [
    input.originalSaleId,
    input.amountTwd,
    qty,
    input.originalCollectionChannel,
    input.originalCommissionRateSnapshot,
  ].join('|');
}

function uniqueRefundsByKey(refunds: readonly RefundReversalLine[]): RefundReversalLine[] {
  const seen = new Map<string, RefundReversalLine>();
  for (const row of refunds) {
    parseCollectionChannel(row.originalCollectionChannel);
    assertIntegerPercent(row.originalCommissionRateSnapshot);
    assertTwdInteger(row.commissionReversalSnapshot, '佣金回沖 snapshot');
    const existing = seen.get(row.idempotencyKey);
    if (!existing) {
      seen.set(row.idempotencyKey, row);
      continue;
    }
    if (refundFingerprint(existing) !== refundFingerprint(row)) {
      throw new Error('同一 idempotencyKey 不可對應不同退款內容');
    }
  }
  return [...seen.values()];
}

export function assertRefundLineMatchesSale(
  sale: CompletedSaleLine,
  row: RefundReversalLine,
): void {
  parseCollectionChannel(row.originalCollectionChannel);
  assertIntegerPercent(row.originalCommissionRateSnapshot);
  assertTwdInteger(row.amountTwd, '退款金額');
  assertTwdInteger(row.commissionReversalSnapshot, '佣金回沖 snapshot');
  if (row.originalSaleId !== sale.id) {
    throw new Error('退款 line 必須指向原 sale');
  }
  if (row.originalCollectionChannel !== sale.collectionChannel) {
    throw new Error('既有退款 line 的 collection channel 與原 sale snapshot 不一致');
  }
  if (row.originalCommissionRateSnapshot !== sale.commissionRateSnapshot) {
    throw new Error('既有退款 line 的佣金率與原 sale snapshot 不一致');
  }
}

export function refundableRemainder(
  sale: CompletedSaleLine,
  refunds: readonly RefundReversalLine[],
): { amountTwd: TwdInteger; quantity: NonNegativeIntegerUnits | null } {
  assertSaleCommissionSnapshotConsistent(sale);
  const unique = uniqueRefundsByKey(refunds);
  let amount = 0;
  let qty = 0;
  let commission = 0;
  let hasQty = false;
  for (const row of unique) {
    assertRefundLineMatchesSale(sale, row);
    amount = safeIntegerAdd(amount, row.amountTwd, '累計退款金額');
    commission = safeIntegerAdd(commission, row.commissionReversalSnapshot, '累計佣金回沖');
    if (row.quantity != null) {
      assertNonNegativeIntegerUnits(row.quantity, '退款數量');
      qty = safeIntegerAdd(qty, row.quantity, '累計退款數量');
      hasQty = true;
    }
  }
  if (amount > sale.actualGrossTwd) {
    throw new Error('累計退款金額不可超過原可退餘額');
  }
  if (hasQty && sale.quantity != null && qty > sale.quantity) {
    throw new Error('累計退款數量不可超過原可退餘額');
  }
  if (commission > sale.commissionAmountSnapshot) {
    throw new Error('累計佣金回沖不可超過原 commission snapshot');
  }
  return {
    amountTwd: sale.actualGrossTwd - amount,
    quantity: sale.quantity != null ? sale.quantity - qty : null,
  };
}

export function sumCommissionReversals(refunds: readonly RefundReversalLine[]): TwdInteger {
  let total = 0;
  for (const row of uniqueRefundsByKey(refunds)) {
    assertTwdInteger(row.commissionReversalSnapshot, '佣金回沖 snapshot');
    total = safeIntegerAdd(total, row.commissionReversalSnapshot, '累計佣金回沖');
  }
  return total;
}

/** 本筆回沖 = 原 snapshot − 退後剩餘淨額依原 rate 應得 − 既有已回沖。 */
export function nextCommissionReversalSnapshot(
  sale: CompletedSaleLine,
  existingRefunds: readonly RefundReversalLine[],
  newAmountTwd: TwdInteger,
): TwdInteger {
  assertSaleCommissionSnapshotConsistent(sale);
  const alreadyRefundedAmount =
    sale.actualGrossTwd - refundableRemainder(sale, existingRefunds).amountTwd;
  const refundedAfterThis = safeIntegerAdd(alreadyRefundedAmount, newAmountTwd, '退後已退金額');
  if (refundedAfterThis > sale.actualGrossTwd) {
    throw new Error('累計退款金額不可超過原可退餘額');
  }
  const remainingNet = sale.actualGrossTwd - refundedAfterThis;
  const deservedOnRemain = roundPercentCommission(remainingNet, sale.commissionRateSnapshot);
  const already = sumCommissionReversals(existingRefunds);
  const reversal = sale.commissionAmountSnapshot - deservedOnRemain - already;
  if (!Number.isSafeInteger(reversal)) {
    throw new Error('佣金回沖超出安全整數');
  }
  if (reversal < 0) {
    throw new Error('佣金回沖不可超過原 commission snapshot');
  }
  const cumulative = safeIntegerAdd(already, reversal, '累計佣金回沖');
  if (cumulative > sale.commissionAmountSnapshot) {
    throw new Error('佣金回沖不可超過原 commission snapshot');
  }
  return reversal;
}

export function projectSaleReversalState(
  sale: CompletedSaleLine,
  refunds: readonly RefundReversalLine[],
): SaleReversalProjection {
  const remain = refundableRemainder(sale, refunds);
  if (remain.amountTwd === sale.actualGrossTwd) return 'not_reversed';
  if (remain.amountTwd === 0) return 'fully_reversed';
  return 'partially_reversed';
}

export function parseClientRefundBusinessInput(input: UntrustedClientRefundInput): {
  actualUnitPriceTwd?: TwdInteger;
  requestedQuantity?: NonNegativeIntegerUnits;
  requestedAmountTwd?: TwdInteger;
} {
  const parsed: {
    actualUnitPriceTwd?: TwdInteger;
    requestedQuantity?: NonNegativeIntegerUnits;
    requestedAmountTwd?: TwdInteger;
  } = {};
  if (input.actualUnitPriceTwd !== undefined) {
    assertTwdInteger(input.actualUnitPriceTwd, 'actualUnitPriceTwd');
    parsed.actualUnitPriceTwd = input.actualUnitPriceTwd;
  }
  if (input.requestedQuantity !== undefined) {
    assertPositiveUnits(input.requestedQuantity, '退款數量');
    parsed.requestedQuantity = input.requestedQuantity;
  }
  if (input.requestedAmountTwd !== undefined) {
    assertPositiveTwdInteger(input.requestedAmountTwd, '退款金額');
    parsed.requestedAmountTwd = input.requestedAmountTwd;
  }
  return parsed;
}

export function applyRefundReversalLine(input: {
  sale: CompletedSaleLine;
  existingRefunds: readonly RefundReversalLine[];
  clientInput: UntrustedClientRefundInput;
  idempotencyKey: string;
}): { line: RefundReversalLine; duplicate: boolean } {
  assertSaleCommissionSnapshotConsistent(input.sale);
  if (!input.idempotencyKey) {
    throw new Error('退款必須有 idempotencyKey');
  }
  const parsed = parseClientRefundBusinessInput(input.clientInput);
  if (parsed.requestedAmountTwd == null) {
    throw new Error('server 必須從已驗證的退款金額建立 line');
  }
  const channel = parseCollectionChannel(input.sale.collectionChannel);
  const candidateFingerprint = refundFingerprint({
    originalSaleId: input.sale.id,
    amountTwd: parsed.requestedAmountTwd,
    quantity: parsed.requestedQuantity,
    originalCollectionChannel: channel,
    originalCommissionRateSnapshot: input.sale.commissionRateSnapshot,
  });

  const remain = refundableRemainder(input.sale, input.existingRefunds);
  const prior = input.existingRefunds.find((row) => row.idempotencyKey === input.idempotencyKey);
  if (prior) {
    assertRefundLineMatchesSale(input.sale, prior);
    if (refundFingerprint(prior) !== candidateFingerprint) {
      throw new Error('同一 idempotencyKey 不可對應不同退款內容');
    }
    return { line: prior, duplicate: true };
  }
  if (parsed.requestedAmountTwd > remain.amountTwd) {
    throw new Error('累計退款金額不可超過原可退餘額');
  }
  if (parsed.requestedQuantity != null) {
    if (input.sale.quantity == null) {
      throw new Error('原交易沒有數量，不可退數量');
    }
    if (remain.quantity == null || parsed.requestedQuantity > remain.quantity) {
      throw new Error('累計退款數量不可超過原可退餘額');
    }
  }

  const commissionReversalSnapshot = nextCommissionReversalSnapshot(
    input.sale,
    input.existingRefunds,
    parsed.requestedAmountTwd,
  );
  return {
    line: {
      originalSaleId: input.sale.id,
      amountTwd: parsed.requestedAmountTwd,
      quantity: parsed.requestedQuantity,
      originalCollectionChannel: channel,
      originalCommissionRateSnapshot: input.sale.commissionRateSnapshot,
      commissionReversalSnapshot,
      idempotencyKey: input.idempotencyKey,
    },
    duplicate: false,
  };
}

export function refundReversalLedger(
  sale: CompletedSaleLine,
  refund: RefundReversalLine,
): RefundReversalLedger {
  assertSaleCommissionSnapshotConsistent(sale);
  parseCollectionChannel(refund.originalCollectionChannel);
  if (refund.originalSaleId !== sale.id) {
    throw new Error('退款 line 必須指向原 sale');
  }
  if (refund.originalCollectionChannel !== sale.collectionChannel) {
    throw new Error('退款必須使用原 collection channel snapshot');
  }
  if (refund.originalCommissionRateSnapshot !== sale.commissionRateSnapshot) {
    throw new Error('退款必須使用原 commission rate snapshot');
  }
  assertTwdInteger(refund.commissionReversalSnapshot, '佣金回沖 snapshot');
  const locked = sale.settlementStatus != null && isSettlementLocked(sale.settlementStatus);
  const destination = locked ? 'next_period_adjustment' : 'current_open_period';
  const kind = locked ? 'next_period_adjustment' : 'reversal';
  const commissionTwd = refund.commissionReversalSnapshot;

  if (sale.collectionChannel === 'merchant_collected') {
    return {
      originalSaleId: sale.id,
      kind,
      direction: 'hq_owes_merchant',
      refundAmountTwd: refund.amountTwd,
      commissionTwd,
      merchantOwesHqTwd: 0,
      hqOwesMerchantTwd: refund.amountTwd - commissionTwd,
      settlementDestination: destination,
    };
  }

  return {
    originalSaleId: sale.id,
    kind,
    direction: 'merchant_owes_hq',
    refundAmountTwd: refund.amountTwd,
    commissionTwd,
    merchantOwesHqTwd: commissionTwd,
    hqOwesMerchantTwd: 0,
    settlementDestination: destination,
  };
}

// ---------------------------------------------------------------------------
// 美容券
// ---------------------------------------------------------------------------

export type VoucherSubsidyLedger = {
  kind: 'voucher_fixed_subsidy';
  direction: 'hq_owes_merchant';
  voucherFaceTwd: TwdInteger;
  commissionTwd: 0;
  merchantOwesHqTwd: 0;
  hqOwesMerchantTwd: TwdInteger;
};

export type VoucherCancellationRequest = {
  requestId: string;
  voucherId: string;
  status: CancellationRequestStatus;
  requestedBy: PosActor;
};

export type VoucherSubsidyReversalLine = {
  originalRedemptionId: string;
  voucherId: string;
  amountTwd: TwdInteger;
  direction: 'merchant_owes_hq';
  kind: 'reversal' | 'next_period_adjustment';
  pointsDelta: typeof GROOMING_VOUCHER_POINTS;
  actor: PosActor;
  reason: string;
  idempotencyKey: string;
};

export type VoucherCancellationPointsLine = {
  pointsDelta: typeof GROOMING_VOUCHER_POINTS;
  voucherId: string;
  redemptionId: string;
  idempotencyKey: string;
};

export type VoucherCancellationDecision = {
  requestStatus: CancellationRequestStatus;
  voucherStatus: VoucherStatus;
  duplicate: boolean;
  fingerprint: string;
  pointsLine: VoucherCancellationPointsLine | null;
  subsidyLine: VoucherSubsidyReversalLine | null;
};

export type StoredVoucherCancellationResult = {
  idempotencyKey: string;
  fingerprint: string;
  requestStatus: CancellationRequestStatus;
  voucherStatus: VoucherStatus;
  pointsLine: VoucherCancellationPointsLine | null;
  subsidyLine: VoucherSubsidyReversalLine | null;
};

export function groomingVoucherFaceTwd(tier: unknown): TwdInteger {
  const parsed = parseVoucherTier(tier);
  if (parsed === 'zhuwo_250') return GROOMING_VOUCHER_FACE_ZHUWO_TWD;
  if (parsed === 'standard_200') return GROOMING_VOUCHER_FACE_STANDARD_TWD;
  throw new Error('美容券面額層級不在 allow-list，未知或大小寫不符');
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

export function voucherRedemptionLedger(tier: unknown): VoucherSubsidyLedger {
  const voucherFaceTwd = groomingVoucherFaceTwd(tier);
  return {
    kind: 'voucher_fixed_subsidy',
    direction: 'hq_owes_merchant',
    voucherFaceTwd,
    commissionTwd: 0,
    merchantOwesHqTwd: 0,
    hqOwesMerchantTwd: voucherFaceTwd,
  };
}

export function freezeGroomingVoucherExpiresAt(issuedAt: Date): Date {
  assertValidDate(issuedAt, '發券時間');
  return new Date(issuedAt.getTime() + GROOMING_VOUCHER_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

export function isGroomingVoucherUsable(now: Date, expiresAt: Date): boolean {
  assertValidDate(now, '現在時間');
  assertValidDate(expiresAt, '到期時間');
  return now < expiresAt;
}

export function expiredVoucherRefundsPoints(): false {
  return false;
}

export function canRequestVoucherCancel(actor: unknown): boolean {
  const parsed = parsePosActor(actor);
  return parsed === 'merchant_staff' || parsed === 'merchant_owner';
}

export function canApproveVoucherCancel(actor: unknown): boolean {
  return parsePosActor(actor) === 'hq';
}

export function requestVoucherCancellation(input: {
  requestId: string;
  voucherStatus: unknown;
  actor: unknown;
  voucherId: string;
}): VoucherCancellationRequest {
  const requestId = assertRequiredContractText(input.requestId, '取消申請 requestId');
  const voucherId = assertRequiredContractText(input.voucherId, '取消申請 voucherId');
  const voucherStatus = parseVoucherStatus(input.voucherStatus);
  if (voucherStatus !== 'redeemed') {
    throw new Error('只有已核銷的美容券可由店家提出爭議取消');
  }
  if (!canRequestVoucherCancel(input.actor)) {
    throw new Error('只有店家可以提出美容券取消申請');
  }
  return {
    requestId,
    voucherId,
    status: 'pending',
    requestedBy: parsePosActor(input.actor),
  };
}

export function voucherCancelFingerprint(input: {
  requestId: string;
  voucherId: string;
  redemptionId: string;
  decision: Exclude<CancellationRequestStatus, 'pending'>;
  voucherTier: GroomingVoucherFaceTier;
  settlementStatus: SettlementStatus | null;
  reason: string;
}): string {
  return [
    input.requestId,
    input.voucherId,
    input.redemptionId,
    input.decision,
    input.voucherTier,
    input.settlementStatus ?? '',
    input.reason,
  ].join('|');
}

export function storeVoucherCancellationDecision(
  idempotencyKey: string,
  decision: VoucherCancellationDecision,
): StoredVoucherCancellationResult {
  return {
    idempotencyKey,
    fingerprint: decision.fingerprint,
    requestStatus: decision.requestStatus,
    voucherStatus: decision.voucherStatus,
    pointsLine: decision.pointsLine,
    subsidyLine: decision.subsidyLine,
  };
}

export function decideVoucherCancellation(input: {
  voucherId: string;
  voucherStatus: unknown;
  redemptionId: string;
  request: VoucherCancellationRequest;
  actor: unknown;
  decision: unknown;
  voucherTier: unknown;
  settlementStatus: unknown | null;
  reason: string;
  idempotencyKey: string;
  existingResults: readonly StoredVoucherCancellationResult[];
}): VoucherCancellationDecision {
  const idempotencyKey = assertRequiredContractText(input.idempotencyKey, 'idempotencyKey');
  const requestId = assertRequiredContractText(input.request.requestId, 'requestId');
  const voucherId = assertRequiredContractText(input.voucherId, 'voucherId');
  const redemptionId = assertRequiredContractText(input.redemptionId, 'redemptionId');
  const reason = assertRequiredContractText(input.reason, 'reason');
  const decision = parseCancellationRequestStatus(input.decision);
  if (decision === 'pending') {
    throw new Error('審核結果不可為 pending');
  }
  const tier = parseVoucherTier(input.voucherTier);
  const settlementStatus =
    input.settlementStatus == null ? null : parseSettlementStatus(input.settlementStatus);
  const fingerprint = voucherCancelFingerprint({
    requestId,
    voucherId,
    redemptionId,
    decision,
    voucherTier: tier,
    settlementStatus,
    reason,
  });

  const prior = input.existingResults.find((row) => row.idempotencyKey === idempotencyKey);
  if (prior) {
    if (prior.fingerprint !== fingerprint) {
      throw new Error('同一 idempotencyKey 不可對應不同美容券取消內容');
    }
    return {
      requestStatus: prior.requestStatus,
      voucherStatus: prior.voucherStatus,
      duplicate: true,
      fingerprint: prior.fingerprint,
      pointsLine: prior.pointsLine,
      subsidyLine: prior.subsidyLine,
    };
  }

  if (input.request.voucherId !== voucherId) {
    throw new Error('取消申請的 voucherId 必須等於被取消券');
  }
  if (!canApproveVoucherCancel(input.actor)) {
    throw new Error('只有 HQ 才能核准或拒絕美容券取消');
  }
  const voucherStatus = parseVoucherStatus(input.voucherStatus);
  if (voucherStatus !== 'redeemed') {
    throw new Error('取消申請審核時券必須仍為 redeemed');
  }
  if (input.request.status !== 'pending') {
    throw new Error('只能審核 pending 的取消申請');
  }

  if (decision === 'rejected') {
    return {
      requestStatus: 'rejected',
      voucherStatus: 'redeemed',
      duplicate: false,
      fingerprint,
      pointsLine: null,
      subsidyLine: null,
    };
  }

  const face = groomingVoucherFaceTwd(tier);
  const locked = settlementStatus != null && isSettlementLocked(settlementStatus);
  const subsidyLine: VoucherSubsidyReversalLine = {
    originalRedemptionId: redemptionId,
    voucherId,
    amountTwd: face,
    direction: 'merchant_owes_hq',
    kind: locked ? 'next_period_adjustment' : 'reversal',
    pointsDelta: GROOMING_VOUCHER_POINTS,
    actor: parsePosActor(input.actor),
    reason,
    idempotencyKey,
  };
  return {
    requestStatus: 'approved',
    voucherStatus: 'cancelled',
    duplicate: false,
    fingerprint,
    pointsLine: {
      pointsDelta: GROOMING_VOUCHER_POINTS,
      voucherId,
      redemptionId,
      idempotencyKey,
    },
    subsidyLine,
  };
}

// ---------------------------------------------------------------------------
// 結算
// ---------------------------------------------------------------------------

export type SettlementAdjustment = {
  amountTwd: TwdInteger;
  direction: LedgerDirection;
  reference: string;
  reason: string;
  requestedBy: PosActor;
  approvedBy: PosActor | null;
  effectivePeriod: { start: Date; end: Date };
  idempotencyKey: string;
  kind: AdjustmentKind;
};

export function isSettlementLocked(status: unknown): boolean {
  const parsed = parseSettlementStatus(status);
  return parsed === 'approved' || parsed === 'paid';
}

export function canRewriteSettlementFacts(_status: unknown): false {
  return false;
}

export function canEditSettlementDraftMetadata(actor: unknown, status: unknown): boolean {
  const parsedStatus = parseSettlementStatus(status);
  return parsePosActor(actor) === 'hq' && (parsedStatus === 'draft' || parsedStatus === 'reviewing');
}

export function canWriteSettlementPaymentMetadata(actor: unknown, status: unknown): boolean {
  return parsePosActor(actor) === 'hq' && parseSettlementStatus(status) === 'approved';
}

export function canReopenSettlement(_status: unknown): boolean {
  return false;
}

export function correctionForLockedSettlement(status: unknown): 'next_period_adjustment' {
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

export function assertApprovedSettlementLinesImmutable(): never {
  throw new Error('已核准結算的 lines／amounts 永久鎖定，不可修改');
}

export function buildSettlementAdjustment(input: {
  amountTwd: unknown;
  direction: unknown;
  reference: string;
  reason: string;
  requestedBy: unknown;
  approvedBy: unknown;
  effectivePeriod: { start: unknown; end: unknown };
  idempotencyKey: string;
  kind: unknown;
}): SettlementAdjustment {
  assertPositiveTwdInteger(input.amountTwd, '加減款金額');
  if (!input.reference || !input.reason || !input.idempotencyKey) {
    throw new Error('adjustment 必須有 reference、reason、idempotencyKey');
  }
  const requestedBy = parsePosActor(input.requestedBy);
  const approvedBy = input.approvedBy == null ? null : parsePosActor(input.approvedBy);
  if (approvedBy != null && approvedBy !== 'hq') {
    throw new Error('只有 HQ 能核准 adjustment');
  }
  return {
    amountTwd: input.amountTwd,
    direction: parseLedgerDirection(input.direction),
    reference: input.reference,
    reason: input.reason,
    requestedBy,
    approvedBy,
    effectivePeriod: assertValidPeriod(input.effectivePeriod.start, input.effectivePeriod.end),
    idempotencyKey: input.idempotencyKey,
    kind: parseAdjustmentKind(input.kind),
  };
}

export function uncollectedPickupAction(): typeof UNCOLLECTED_PICKUP_POLICY {
  return UNCOLLECTED_PICKUP_POLICY;
}

// ---------------------------------------------------------------------------
// 角色與補貨取消（取消事件，不寫出 allow-list 沒有的狀態）
// ---------------------------------------------------------------------------

export function canChangeCommissionRate(actor: unknown): boolean {
  return parsePosActor(actor) === 'hq';
}

export function canProposeExtraAdjustment(actor: unknown): boolean {
  const parsed = parsePosActor(actor);
  return parsed === 'merchant_owner' || parsed === 'hq';
}

export function canApproveAdjustment(actor: unknown): boolean {
  return parsePosActor(actor) === 'hq';
}

export type RestockCancelPlan = {
  allowed: boolean;
  mode: 'status_transition' | 'cancellation_event' | 'none';
  requestTo: RestockRequestStatus | null;
  shipmentAction: 'none' | 'cancel_shipment';
  reason: string;
};

export function planRestockCancel(
  requestStatus: unknown,
  shipmentStatus: unknown | null,
): RestockCancelPlan {
  const request = parseRestockRequestStatus(requestStatus);
  if (request === 'rejected' || request === 'cancelled') {
    return {
      allowed: false,
      mode: 'none',
      requestTo: null,
      shipmentAction: 'none',
      reason: '申請已結束',
    };
  }
  if (request === 'draft' || request === 'submitted' || request === 'under_review') {
    if (!canTransitionRestockRequest(request, 'cancelled')) {
      throw new Error('補貨取消計畫與 canonical 轉移不一致');
    }
    return {
      allowed: true,
      mode: 'status_transition',
      requestTo: 'cancelled',
      shipmentAction: 'none',
      reason: '尚未轉出貨，允許狀態取消',
    };
  }
  if (request === 'approved') {
    if (shipmentStatus != null) {
      throw new Error('approved 且已有出貨時應走 converted_to_shipment 規則');
    }
    return {
      allowed: true,
      mode: 'cancellation_event',
      requestTo: null,
      shipmentAction: 'none',
      reason: '不改寫 approved 原申請，另建取消事件',
    };
  }
  const shipment = parseRestockShipmentStatus(shipmentStatus);
  if (shipment === 'pending' || shipment === 'packed') {
    return {
      allowed: true,
      mode: 'cancellation_event',
      requestTo: null,
      shipmentAction: 'cancel_shipment',
      reason: '不改寫原申請；另建取消事件並取消未寄出出貨',
    };
  }
  return {
    allowed: false,
    mode: 'none',
    requestTo: null,
    shipmentAction: 'none',
    reason: '已寄出或已送達不可取消，需另案處理',
  };
}

export function assertRestockCancelPlanConsistent(
  requestStatus: unknown,
  plan: RestockCancelPlan,
): void {
  if (plan.mode === 'status_transition') {
    if (plan.requestTo == null || !canTransitionRestockRequest(requestStatus, plan.requestTo)) {
      throw new Error('補貨取消計畫與 canonical 轉移不一致');
    }
  }
  if (plan.mode === 'cancellation_event' && plan.requestTo != null) {
    throw new Error('取消事件不得改寫原申請狀態');
  }
}

