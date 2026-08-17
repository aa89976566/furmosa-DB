/**
 * POS-01 Domain Contract — 可落 DB 的不變量與純決策。
 * 不得被 app／API／cron／既有 runtime 引用。Production 行為零改變。
 * 規格：docs/POS-01-DOMAIN-CONTRACT.md
 */

// ---------------------------------------------------------------------------
// 未決事項 — 不得猜測
// ---------------------------------------------------------------------------

export const POS_01_OPEN_DECISIONS = {
  zhuwoOfficialImmutableIds: {
    id: 'O3',
    status: 'UNDECIDED',
    note: '豬窩三店正式 immutable IDs 尚未決定；禁止用中文店名辨識',
  },
} as const;

export const POS_01_REFUND_INVENTORY_POLICY = {
  id: 'O1',
  status: 'FROZEN',
  merchantRequestsHqApproves: true,
  originalSaleAndCommissionSnapshotsImmutable: true,
  unfulfilled: 'release_only',
  fulfilledReturnedSellable: 'restock_sellable',
  fulfilledReturnedUnsellable: 'loss_unsellable',
  fulfilledNotReturned: 'no_stock_effect',
  financialFullyReversedByAmountOnly: true,
  runtimeAuthNotImplemented: true,
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
  'refundSourceKind',
  'fulfillmentFact',
  'physicalReturnFact',
  'refundDisposition',
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

export const REFUND_SOURCE_KINDS = ['pos_sale_line', 'online_sale_snapshot_line'] as const;
export type RefundSourceKind = (typeof REFUND_SOURCE_KINDS)[number];

export const REFUND_FULFILLMENT_FACTS = ['unfulfilled', 'fulfilled'] as const;
export type RefundFulfillmentFact = (typeof REFUND_FULFILLMENT_FACTS)[number];

export const REFUND_PHYSICAL_RETURN_FACTS = ['not_returned', 'returned'] as const;
export type RefundPhysicalReturnFact = (typeof REFUND_PHYSICAL_RETURN_FACTS)[number];

export const REFUND_INVENTORY_DISPOSITIONS = [
  'release_only',
  'restock_sellable',
  'loss_unsellable',
  'no_stock_effect',
] as const;
export type RefundInventoryDisposition = (typeof REFUND_INVENTORY_DISPOSITIONS)[number];

export const REFUND_RETURN_CONDITIONS = [
  'unopened_good_sellable',
  'opened',
  'damaged',
  'spoiled',
  'contaminated',
  'other_unsellable',
] as const;
export type RefundReturnCondition = (typeof REFUND_RETURN_CONDITIONS)[number];

export const UNSELLABLE_RETURN_CONDITIONS = [
  'opened',
  'damaged',
  'spoiled',
  'contaminated',
  'other_unsellable',
] as const;

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
export function parseRefundSourceKind(value: unknown): RefundSourceKind {
  return parseAllowListValue(value, REFUND_SOURCE_KINDS, '退款來源');
}
export function parseRefundFulfillmentFact(value: unknown): RefundFulfillmentFact {
  return parseAllowListValue(value, REFUND_FULFILLMENT_FACTS, '履約事實');
}
export function parseRefundPhysicalReturnFact(value: unknown): RefundPhysicalReturnFact {
  return parseAllowListValue(value, REFUND_PHYSICAL_RETURN_FACTS, '實物退回事實');
}
export function parseRefundInventoryDisposition(value: unknown): RefundInventoryDisposition {
  return parseAllowListValue(value, REFUND_INVENTORY_DISPOSITIONS, '退款庫存處置');
}
export function parseRefundReturnCondition(value: unknown): RefundReturnCondition {
  return parseAllowListValue(value, REFUND_RETURN_CONDITIONS, '退貨狀態');
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

export function assertPositiveUnits(qty: unknown, label = '數量'): NonNegativeIntegerUnits {
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

export function inventoryEffectOfRefund(): typeof POS_01_REFUND_INVENTORY_POLICY {
  return POS_01_REFUND_INVENTORY_POLICY;
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

export function refundRequestFingerprint(input: {
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

export function refundLineFingerprint(row: RefundReversalLine): string {
  parseCollectionChannel(row.originalCollectionChannel);
  assertIntegerPercent(row.originalCommissionRateSnapshot);
  assertTwdInteger(row.amountTwd, '退款金額');
  assertTwdInteger(row.commissionReversalSnapshot, '佣金回沖 snapshot');
  return [
    refundRequestFingerprint({
      originalSaleId: row.originalSaleId,
      amountTwd: row.amountTwd,
      quantity: row.quantity,
      originalCollectionChannel: row.originalCollectionChannel,
      originalCommissionRateSnapshot: row.originalCommissionRateSnapshot,
    }),
    String(row.commissionReversalSnapshot),
  ].join('|');
}

export function refundFingerprint(row: RefundReversalLine): string {
  return refundLineFingerprint(row);
}

function uniqueRefundsByKey(refunds: readonly RefundReversalLine[]): RefundReversalLine[] {
  const seen = new Map<string, RefundReversalLine>();
  for (const row of refunds) {
    const fingerprint = refundLineFingerprint(row);
    const existing = seen.get(row.idempotencyKey);
    if (!existing) {
      seen.set(row.idempotencyKey, row);
      continue;
    }
    if (refundLineFingerprint(existing) !== fingerprint) {
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
  const expected = expectedCumulativeCommissionReversal(sale, amount);
  if (commission !== expected) {
    throw new Error('既有退款佣金回沖與剩餘淨額公式不一致');
  }
  return {
    amountTwd: sale.actualGrossTwd - amount,
    quantity: sale.quantity != null ? sale.quantity - qty : null,
  };
}

export function expectedCumulativeCommissionReversal(
  sale: CompletedSaleLine,
  refundedAmountTwd: TwdInteger,
): TwdInteger {
  assertSaleCommissionSnapshotConsistent(sale);
  assertTwdInteger(refundedAmountTwd, '累計退款金額');
  if (refundedAmountTwd > sale.actualGrossTwd) {
    throw new Error('累計退款金額不可超過原可退餘額');
  }
  const remainingNet = sale.actualGrossTwd - refundedAmountTwd;
  const deservedOnRemain = roundPercentCommission(remainingNet, sale.commissionRateSnapshot);
  const expected = sale.commissionAmountSnapshot - deservedOnRemain;
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw new Error('既有退款佣金回沖與剩餘淨額公式不一致');
  }
  return expected;
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
    parsed.requestedQuantity = assertPositiveUnits(input.requestedQuantity, '退款數量');
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
  const candidateRequestFingerprint = refundRequestFingerprint({
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
    if (refundRequestFingerprint(prior) !== candidateRequestFingerprint) {
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
  const actor = parsePosActor(input.actor);
  if (actor !== 'hq') {
    throw new Error('只有 HQ 才能核准或拒絕美容券取消');
  }

  const requestId = assertRequiredContractText(input.request.requestId, 'requestId');
  const voucherId = assertRequiredContractText(input.voucherId, 'voucherId');
  const requestVoucherId = assertRequiredContractText(input.request.voucherId, '取消申請 voucherId');
  if (requestVoucherId !== voucherId) {
    throw new Error('取消申請的 voucherId 必須等於被取消券');
  }
  const redemptionId = assertRequiredContractText(input.redemptionId, 'redemptionId');

  const idempotencyKey = assertRequiredContractText(input.idempotencyKey, 'idempotencyKey');
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
    actor,
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

export function canRequestRefund(actor: unknown): boolean {
  const parsed = parsePosActor(actor);
  return parsed === 'merchant_staff' || parsed === 'merchant_owner';
}

export function canApproveRefund(actor: unknown): boolean {
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

// ---------------------------------------------------------------------------
// O1 退款庫存 — 唯一凍結政策；只回 immutable plan，不寫 DB
// ---------------------------------------------------------------------------

export type RefundInventoryEffectPlan = {
  disposition: Exclude<RefundInventoryDisposition, 'no_stock_effect'>;
  qty: NonNegativeIntegerUnits;
  reservedDelta: number;
  onHandDelta: number;
  inventoryAggregateId: string;
  loss: {
    qty: NonNegativeIntegerUnits;
    condition: RefundReturnCondition;
    note: string | null;
  } | null;
};

export type RefundCompletionSource = {
  kind: RefundSourceKind;
  sourceLineId: string;
  sourceOrderId: string | null;
  sourceSnapshotLineId: string | null;
};

export type RefundCompletionFinancial = {
  line: RefundReversalLine;
  ledger: RefundReversalLedger;
  saleReversal: SaleReversalProjection;
};

export type RefundCommittedOutcomeSnapshot = {
  financialReversal: RefundCompletionFinancial;
  inventoryEffect: RefundInventoryEffectPlan | null;
  source: RefundCompletionSource;
  commissionReversalSnapshot: TwdInteger;
  ledgerDirection: LedgerDirection;
  ledgerKind: RefundReversalLedger['kind'];
  settlementDestination: RefundReversalLedger['settlementDestination'];
  settlementStatusAtExecution: SettlementStatus | null;
};

export type RefundCompletionResult = {
  currentPersistedStatus: 'approved' | 'completed';
  proposedNextStatus: 'completed' | null;
  financialReversal: RefundCompletionFinancial;
  inventoryEffect: RefundInventoryEffectPlan | null;
  duplicate: boolean;
  fingerprint: string;
  requestFingerprint: string;
  source: RefundCompletionSource;
  committedOutcomeSnapshot: RefundCommittedOutcomeSnapshot | null;
};

export type StoredRefundCompletion = {
  idempotencyKey: string;
  requestFingerprint: string;
  persistedRequestStatus: 'completed';
  committedOutcomeSnapshot: RefundCommittedOutcomeSnapshot;
};

export const REFUND_INVENTORY_LEDGER_OPERATIONS = ['release', 'restock', 'loss'] as const;
export type RefundInventoryLedgerOperation = (typeof REFUND_INVENTORY_LEDGER_OPERATIONS)[number];

export function parseRefundInventoryLedgerOperation(
  value: unknown,
): RefundInventoryLedgerOperation {
  return parseAllowListValue(value, REFUND_INVENTORY_LEDGER_OPERATIONS, '退款庫存帳本操作');
}

export type RefundFinancialLedgerReceipt = {
  reference: string;
  idempotencyKey: string;
  refundLineFingerprint: string;
  refundAmountTwd: TwdInteger;
  commissionTwd: TwdInteger;
  direction: LedgerDirection;
  kind: RefundReversalLedger['kind'];
  settlementDestination: RefundReversalLedger['settlementDestination'];
  settlementStatusAtExecution: SettlementStatus | null;
  merchantOwesHqTwd: TwdInteger;
  hqOwesMerchantTwd: TwdInteger;
};

export type RefundDispositionReceipt = {
  refundRequestId: string;
  sourceKind: RefundSourceKind;
  sourceLineId: string;
  inventoryAggregateId: string;
  qty: NonNegativeIntegerUnits;
  disposition: Exclude<RefundInventoryDisposition, 'no_stock_effect'>;
  condition: RefundReturnCondition | null;
  reason: string;
};

export type RefundLossReceipt = {
  inventoryAggregateId: string;
  qty: NonNegativeIntegerUnits;
  condition: RefundReturnCondition;
  note: string | null;
};

export type RefundInventoryLedgerReceipt = {
  inventoryAggregateId: string;
  operation: RefundInventoryLedgerOperation;
  qty: NonNegativeIntegerUnits;
  onHandDelta: number;
  reservedDelta: number;
};

export type MerchantStockDeltaReceipt = {
  inventoryAggregateId: string;
  onHandDelta: number;
  reservedDelta: number;
  applied: true;
};

/** 未來 adapter 從 DB 讀回的 persistedEffectReceipts；不是 client 輸入，也不寫 DB。 */
export type CommittedEffectsProof = {
  financialLedgerReceipt: RefundFinancialLedgerReceipt | null;
  dispositionReceipt: RefundDispositionReceipt | null;
  lossReceipt: RefundLossReceipt | null;
  inventoryLedgerReceipt: RefundInventoryLedgerReceipt | null;
  merchantStockDeltaReceipt: MerchantStockDeltaReceipt | null;
};

function expectedInventoryLedgerOperation(
  disposition: Exclude<RefundInventoryDisposition, 'no_stock_effect'>,
): RefundInventoryLedgerOperation {
  if (disposition === 'release_only') return 'release';
  if (disposition === 'restock_sellable') return 'restock';
  return 'loss';
}

function expectedDispositionCondition(
  effect: RefundInventoryEffectPlan,
): RefundReturnCondition | null {
  if (effect.disposition === 'restock_sellable') return 'unopened_good_sellable';
  if (effect.disposition === 'loss_unsellable') {
    if (effect.loss == null) {
      throw new Error('已完成退款的 loss 與 stored 不一致');
    }
    return effect.loss.condition;
  }
  return null;
}

function assertSameContractValue(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`已完成退款的 ${label} 與 stored 不一致`);
  }
}

export function assertCommittedEffectsProof(
  proof: CommittedEffectsProof | null | undefined,
  stored: RefundCommittedOutcomeSnapshot,
  identity: {
    refundRequestId: string;
    idempotencyKey: string;
    reason: string;
  },
): void {
  if (proof == null) {
    throw new Error('已完成退款缺少 committed effects proof');
  }
  if (proof.financialLedgerReceipt == null) {
    throw new Error('已完成退款缺少 financial ledger receipt');
  }
  const ledgerReceipt = proof.financialLedgerReceipt;
  const storedLine = stored.financialReversal.line;
  const storedLedger = stored.financialReversal.ledger;
  assertRequiredContractText(ledgerReceipt.reference, 'financial ledger reference');
  assertRequiredContractText(ledgerReceipt.idempotencyKey, 'financial ledger idempotencyKey');
  assertRequiredContractText(ledgerReceipt.refundLineFingerprint, 'financial ledger refund line');
  assertSameContractValue(ledgerReceipt.reference, storedLine.idempotencyKey, 'financial ledger');
  assertPositiveTwdInteger(ledgerReceipt.refundAmountTwd, 'financial ledger 金額');
  assertTwdInteger(ledgerReceipt.commissionTwd, 'financial ledger 佣金');
  assertTwdInteger(ledgerReceipt.merchantOwesHqTwd, 'financial ledger merchantOwesHq');
  assertTwdInteger(ledgerReceipt.hqOwesMerchantTwd, 'financial ledger hqOwesMerchant');
  parseLedgerDirection(ledgerReceipt.direction);
  parseLedgerKind(ledgerReceipt.kind);
  assertSameContractValue(ledgerReceipt.idempotencyKey, identity.idempotencyKey, 'financial ledger');
  assertSameContractValue(ledgerReceipt.idempotencyKey, storedLine.idempotencyKey, 'financial ledger');
  assertSameContractValue(
    ledgerReceipt.refundLineFingerprint,
    refundLineFingerprint(storedLine),
    'financial ledger',
  );
  assertSameContractValue(ledgerReceipt.refundAmountTwd, storedLedger.refundAmountTwd, 'financial ledger');
  assertSameContractValue(ledgerReceipt.commissionTwd, storedLedger.commissionTwd, 'financial ledger');
  assertSameContractValue(ledgerReceipt.direction, storedLedger.direction, 'financial ledger');
  assertSameContractValue(ledgerReceipt.kind, storedLedger.kind, 'financial ledger');
  assertSameContractValue(
    ledgerReceipt.settlementDestination,
    storedLedger.settlementDestination,
    'financial ledger',
  );
  assertSameContractValue(
    ledgerReceipt.settlementStatusAtExecution,
    stored.settlementStatusAtExecution,
    'financial ledger',
  );
  assertSameContractValue(
    ledgerReceipt.merchantOwesHqTwd,
    storedLedger.merchantOwesHqTwd,
    'financial ledger',
  );
  assertSameContractValue(
    ledgerReceipt.hqOwesMerchantTwd,
    storedLedger.hqOwesMerchantTwd,
    'financial ledger',
  );
  assertSameContractValue(ledgerReceipt.kind, stored.ledgerKind, 'financial ledger');
  assertSameContractValue(ledgerReceipt.direction, stored.ledgerDirection, 'financial ledger');
  assertSameContractValue(
    ledgerReceipt.settlementDestination,
    stored.settlementDestination,
    'financial ledger',
  );

  const effect = stored.inventoryEffect;
  if (effect == null) {
    if (
      proof.dispositionReceipt != null ||
      proof.lossReceipt != null ||
      proof.inventoryLedgerReceipt != null ||
      proof.merchantStockDeltaReceipt != null
    ) {
      throw new Error('無庫存效果的完成不可有庫存 receipts');
    }
    return;
  }

  if (proof.dispositionReceipt == null) {
    throw new Error('已完成退款缺少 disposition receipt');
  }
  const dispositionReceipt = proof.dispositionReceipt;
  parseRefundSourceKind(dispositionReceipt.sourceKind);
  parseRefundInventoryDisposition(dispositionReceipt.disposition);
  const receiptCondition =
    dispositionReceipt.condition == null
      ? null
      : parseRefundReturnCondition(dispositionReceipt.condition);
  assertRequiredContractText(dispositionReceipt.refundRequestId, 'disposition refundRequestId');
  assertRequiredContractText(dispositionReceipt.sourceLineId, 'disposition sourceLineId');
  assertRequiredContractText(dispositionReceipt.inventoryAggregateId, 'disposition inventoryAggregateId');
  assertRequiredContractText(dispositionReceipt.reason, 'disposition reason');
  assertPositiveUnits(dispositionReceipt.qty, 'disposition 數量');
  assertSameContractValue(dispositionReceipt.refundRequestId, identity.refundRequestId, 'disposition');
  assertSameContractValue(dispositionReceipt.sourceKind, stored.source.kind, 'disposition');
  assertSameContractValue(dispositionReceipt.sourceLineId, stored.source.sourceLineId, 'disposition');
  assertSameContractValue(
    dispositionReceipt.inventoryAggregateId,
    effect.inventoryAggregateId,
    'disposition',
  );
  assertSameContractValue(dispositionReceipt.qty, effect.qty, 'disposition');
  assertSameContractValue(dispositionReceipt.disposition, effect.disposition, 'disposition');
  assertSameContractValue(receiptCondition, expectedDispositionCondition(effect), 'disposition');
  assertSameContractValue(dispositionReceipt.reason, identity.reason, 'disposition');

  if (effect.disposition === 'loss_unsellable') {
    if (effect.loss == null) {
      throw new Error('已完成退款的 loss 與 stored 不一致');
    }
    if (proof.lossReceipt == null) {
      throw new Error('已完成退款缺少 loss receipt');
    }
    const lossReceipt = proof.lossReceipt;
    parseRefundReturnCondition(lossReceipt.condition);
    assertRequiredContractText(lossReceipt.inventoryAggregateId, 'loss inventoryAggregateId');
    assertPositiveUnits(lossReceipt.qty, 'loss 數量');
    assertSameContractValue(lossReceipt.inventoryAggregateId, effect.inventoryAggregateId, 'loss');
    assertSameContractValue(lossReceipt.qty, effect.loss.qty, 'loss');
    assertSameContractValue(lossReceipt.condition, effect.loss.condition, 'loss');
    assertSameContractValue(lossReceipt.note, effect.loss.note, 'loss');
  } else if (proof.lossReceipt != null) {
    throw new Error('已完成退款有多餘或矛盾的 persisted receipts');
  }

  if (proof.inventoryLedgerReceipt == null) {
    throw new Error('已完成退款缺少 inventory ledger receipt');
  }
  const inventoryLedger = proof.inventoryLedgerReceipt;
  const operation = parseRefundInventoryLedgerOperation(inventoryLedger.operation);
  assertRequiredContractText(inventoryLedger.inventoryAggregateId, 'inventory ledger inventoryAggregateId');
  assertPositiveUnits(inventoryLedger.qty, 'inventory ledger 數量');
  assertSameContractValue(operation, expectedInventoryLedgerOperation(effect.disposition), 'inventory ledger');
  assertSameContractValue(
    inventoryLedger.inventoryAggregateId,
    effect.inventoryAggregateId,
    'inventory ledger',
  );
  assertSameContractValue(inventoryLedger.qty, effect.qty, 'inventory ledger');
  assertSameContractValue(inventoryLedger.onHandDelta, effect.onHandDelta, 'inventory ledger');
  assertSameContractValue(inventoryLedger.reservedDelta, effect.reservedDelta, 'inventory ledger');

  if (proof.merchantStockDeltaReceipt == null) {
    throw new Error('已完成退款缺少 MerchantStock delta receipt');
  }
  const stockDelta = proof.merchantStockDeltaReceipt;
  assertRequiredContractText(stockDelta.inventoryAggregateId, 'MerchantStock inventoryAggregateId');
  if (stockDelta.applied !== true) {
    throw new Error('已完成退款的 MerchantStock delta 與 stored 不一致');
  }
  assertSameContractValue(
    stockDelta.inventoryAggregateId,
    effect.inventoryAggregateId,
    'MerchantStock delta',
  );
  assertSameContractValue(stockDelta.onHandDelta, effect.onHandDelta, 'MerchantStock delta');
  assertSameContractValue(stockDelta.reservedDelta, effect.reservedDelta, 'MerchantStock delta');
}

export function decideRefundRequest(input: {
  currentStatus: unknown;
  decision: unknown;
  actor: unknown;
}): { requestStatus: 'approved' | 'rejected' } {
  if (parsePosActor(input.actor) !== 'hq') {
    throw new Error('只有 HQ 才能核准或拒絕退款');
  }
  const decision = parseRefundStatus(input.decision);
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('退款審核結果只能是 approved 或 rejected');
  }
  assertTransition(REFUND_TRANSITIONS, input.currentStatus, decision, '退款');
  return { requestStatus: decision };
}

export type RefundCompletionRequestIdentity = {
  refundRequestId: string;
  idempotencyKey: string;
  requestedAmountTwd: TwdInteger;
  requestedQuantity: NonNegativeIntegerUnits | null;
  saleId: string;
  originalGrossTwd: TwdInteger;
  collectionChannel: CollectionChannel;
  commissionRateSnapshot: IntegerPercent;
  commissionAmountSnapshot: TwdInteger;
  sourceKind: RefundSourceKind;
  sourceLineId: string;
  sourceOrderId: string | null;
  sourceSnapshotLineId: string | null;
  inventoryAggregateId: string;
  fulfillmentFact: RefundFulfillmentFact;
  physicalReturnFact: RefundPhysicalReturnFact;
  disposition: RefundInventoryDisposition;
  condition: RefundReturnCondition | null;
  reason: string;
  note: string | null;
};

export function serializeRefundCompletionRequestIdentity(
  input: RefundCompletionRequestIdentity,
): string {
  return JSON.stringify({
    refundRequestId: input.refundRequestId,
    idempotencyKey: input.idempotencyKey,
    requestedAmountTwd: input.requestedAmountTwd,
    requestedQuantity: input.requestedQuantity,
    saleId: input.saleId,
    originalGrossTwd: input.originalGrossTwd,
    collectionChannel: input.collectionChannel,
    commissionRateSnapshot: input.commissionRateSnapshot,
    commissionAmountSnapshot: input.commissionAmountSnapshot,
    sourceKind: input.sourceKind,
    sourceLineId: input.sourceLineId,
    sourceOrderId: input.sourceOrderId,
    sourceSnapshotLineId: input.sourceSnapshotLineId,
    inventoryAggregateId: input.inventoryAggregateId,
    fulfillmentFact: input.fulfillmentFact,
    physicalReturnFact: input.physicalReturnFact,
    disposition: input.disposition,
    condition: input.condition,
    reason: input.reason,
    note: input.note,
  });
}

export function refundCompletionFingerprint(input: RefundCompletionRequestIdentity): string {
  return serializeRefundCompletionRequestIdentity(input);
}

export function assertRefundSourceCompatibleWithChannel(
  sourceKind: RefundSourceKind,
  collectionChannel: CollectionChannel,
): void {
  if (sourceKind === 'pos_sale_line' && collectionChannel !== 'merchant_collected') {
    throw new Error('pos_sale_line 只能搭配 merchant_collected');
  }
  if (
    sourceKind === 'online_sale_snapshot_line' &&
    collectionChannel !== 'furmosa_collected_line_ecpay'
  ) {
    throw new Error('online_sale_snapshot_line 只能搭配 furmosa_collected_line_ecpay');
  }
}

function resolveRefundSource(input: {
  sourceKind: unknown;
  sourceLineId: string;
  sourceOrderId?: string;
  sourceSnapshotLineId?: string;
  saleId: string;
}): RefundCompletionSource {
  const kind = parseRefundSourceKind(input.sourceKind);
  const sourceLineId = assertRequiredContractText(input.sourceLineId, 'sourceLineId');
  if (kind === 'pos_sale_line') {
    if (input.sourceOrderId != null && input.sourceOrderId !== '') {
      throw new Error('pos_sale_line 不可帶線上訂單身分');
    }
    if (input.sourceSnapshotLineId != null && input.sourceSnapshotLineId !== '') {
      throw new Error('pos_sale_line 不可帶線上 snapshot 身分');
    }
    if (sourceLineId !== input.saleId) {
      throw new Error('pos_sale_line 的 sourceLineId 必須等於原 line');
    }
    return {
      kind,
      sourceLineId,
      sourceOrderId: null,
      sourceSnapshotLineId: null,
    };
  }
  const sourceOrderId = assertRequiredContractText(input.sourceOrderId, 'sourceOrderId');
  const sourceSnapshotLineId = assertRequiredContractText(
    input.sourceSnapshotLineId,
    'sourceSnapshotLineId',
  );
  if (sourceLineId !== sourceSnapshotLineId || sourceSnapshotLineId !== input.saleId) {
    throw new Error('online_sale_snapshot_line 身分必須一致');
  }
  return {
    kind,
    sourceLineId,
    sourceOrderId,
    sourceSnapshotLineId,
  };
}

export function deriveRefundInventoryDisposition(input: {
  fulfillmentFact: RefundFulfillmentFact;
  physicalReturnFact: RefundPhysicalReturnFact;
  condition: RefundReturnCondition | null;
}): RefundInventoryDisposition {
  if (input.fulfillmentFact === 'unfulfilled') {
    if (input.physicalReturnFact === 'returned' || input.condition != null) {
      throw new Error('未履約取消不可帶實物退回或可售／不可售狀態');
    }
    return 'release_only';
  }
  if (input.physicalReturnFact === 'not_returned') {
    if (input.condition != null) {
      throw new Error('已履約未退物不可帶退貨狀態');
    }
    return 'no_stock_effect';
  }
  if (input.condition == null) {
    throw new Error('已履約且實物退回必須有退貨狀態');
  }
  if (input.condition === 'unopened_good_sellable') return 'restock_sellable';
  return 'loss_unsellable';
}

export function planRefundInventoryEffect(input: {
  fulfillmentFact: unknown;
  physicalReturnFact: unknown;
  disposition: unknown;
  condition?: unknown;
  note?: string;
  qty?: unknown;
  financialQuantity?: NonNegativeIntegerUnits | null;
  inventoryAggregateId: string;
}): {
  disposition: RefundInventoryDisposition;
  effect: RefundInventoryEffectPlan | null;
} {
  const fulfillmentFact = parseRefundFulfillmentFact(input.fulfillmentFact);
  const physicalReturnFact = parseRefundPhysicalReturnFact(input.physicalReturnFact);
  const claimed = parseRefundInventoryDisposition(input.disposition);
  const inventoryAggregateId = assertRequiredContractText(
    input.inventoryAggregateId,
    'inventoryAggregateId',
  );
  const condition =
    input.condition == null || input.condition === ''
      ? null
      : parseRefundReturnCondition(input.condition);
  const derived = deriveRefundInventoryDisposition({
    fulfillmentFact,
    physicalReturnFact,
    condition,
  });
  if (claimed !== derived) {
    throw new Error('退款庫存處置與履約／實物事實不一致');
  }
  if (derived === 'no_stock_effect') {
    return { disposition: derived, effect: null };
  }
  if (input.financialQuantity === null) {
    throw new Error('財務退款數量為空時不可有庫存效果');
  }
  const claimedQty =
    input.qty === undefined || input.qty === null
      ? null
      : assertPositiveUnits(input.qty, '退款庫存數量');
  const qty =
    input.financialQuantity === undefined
      ? claimedQty == null
        ? assertPositiveUnits(input.qty, '退款庫存數量')
        : claimedQty
      : assertPositiveUnits(input.financialQuantity, '退款庫存數量');
  if (claimedQty != null && claimedQty !== qty) {
    throw new Error('庫存處置數量必須等於本次財務退款數量');
  }
  if (derived === 'release_only') {
    return {
      disposition: derived,
      effect: {
        disposition: 'release_only',
        qty,
        reservedDelta: -qty,
        onHandDelta: 0,
        inventoryAggregateId,
        loss: null,
      },
    };
  }
  if (derived === 'restock_sellable') {
    return {
      disposition: derived,
      effect: {
        disposition: 'restock_sellable',
        qty,
        reservedDelta: 0,
        onHandDelta: qty,
        inventoryAggregateId,
        loss: null,
      },
    };
  }
  if (condition == null) {
    throw new Error('不可售退貨必須有退貨狀態');
  }
  let note: string | null = null;
  if (condition === 'other_unsellable') {
    note = assertRequiredContractText(input.note, 'OTHER_UNSELLABLE 說明');
  } else if (input.note != null && input.note.trim() !== '') {
    note = input.note.trim();
  }
  return {
    disposition: derived,
    effect: {
      disposition: 'loss_unsellable',
      qty,
      reservedDelta: 0,
      onHandDelta: 0,
      inventoryAggregateId,
      loss: { qty, condition, note },
    },
  };
}

export function storeRefundCompletion(
  idempotencyKey: string,
  result: RefundCompletionResult,
): StoredRefundCompletion {
  if (result.currentPersistedStatus !== 'approved' || result.proposedNextStatus !== 'completed') {
    throw new Error('只能提交首次 completed 計畫');
  }
  if (result.committedOutcomeSnapshot == null) {
    throw new Error('首次計畫必須有待提交的 outcome snapshot');
  }
  return {
    idempotencyKey,
    requestFingerprint: result.requestFingerprint,
    persistedRequestStatus: 'completed',
    committedOutcomeSnapshot: result.committedOutcomeSnapshot,
  };
}

function assertCommittedFinancialLinePresent(
  existingRefunds: readonly RefundReversalLine[],
  storedLine: RefundReversalLine,
): void {
  const found = existingRefunds.find((row) => row.idempotencyKey === storedLine.idempotencyKey);
  if (!found) {
    throw new Error('已完成退款缺少已提交的財務 line');
  }
  if (refundLineFingerprint(found) !== refundLineFingerprint(storedLine)) {
    throw new Error('已完成退款的財務 line 與 stored 不一致');
  }
}

export function completeApprovedRefund(input: {
  refundRequestId: string;
  refundStatus: unknown;
  actor: unknown;
  sourceKind: unknown;
  sourceLineId: string;
  sourceOrderId?: string;
  sourceSnapshotLineId?: string;
  sale: CompletedSaleLine;
  existingRefunds: readonly RefundReversalLine[];
  clientInput: UntrustedClientRefundInput;
  idempotencyKey: string;
  inventoryAggregateId: string;
  qty?: unknown;
  fulfillmentFact: unknown;
  physicalReturnFact: unknown;
  disposition: unknown;
  condition?: unknown;
  reason: string;
  note?: string;
  existingCompletions: readonly StoredRefundCompletion[];
  committedEffectsProof?: CommittedEffectsProof | null;
}): RefundCompletionResult {
  if (parsePosActor(input.actor) !== 'hq') {
    throw new Error('只有 HQ 才能完成退款');
  }
  const refundRequestId = assertRequiredContractText(input.refundRequestId, 'refundRequestId');
  const source = resolveRefundSource({
    sourceKind: input.sourceKind,
    sourceLineId: input.sourceLineId,
    sourceOrderId: input.sourceOrderId,
    sourceSnapshotLineId: input.sourceSnapshotLineId,
    saleId: input.sale.id,
  });
  const idempotencyKey = assertRequiredContractText(input.idempotencyKey, 'idempotencyKey');
  const reason = assertRequiredContractText(input.reason, 'reason');
  assertSaleCommissionSnapshotConsistent(input.sale);
  const channel = parseCollectionChannel(input.sale.collectionChannel);
  assertRefundSourceCompatibleWithChannel(source.kind, channel);
  const parsed = parseClientRefundBusinessInput(input.clientInput);
  if (parsed.requestedAmountTwd == null) {
    throw new Error('server 必須從已驗證的退款金額建立 line');
  }
  const requestedQuantity = parsed.requestedQuantity ?? null;
  const inventoryAggregateId = assertRequiredContractText(
    input.inventoryAggregateId,
    'inventoryAggregateId',
  );
  const fulfillmentFact = parseRefundFulfillmentFact(input.fulfillmentFact);
  const physicalReturnFact = parseRefundPhysicalReturnFact(input.physicalReturnFact);
  const disposition = parseRefundInventoryDisposition(input.disposition);
  const condition =
    input.condition == null || input.condition === ''
      ? null
      : parseRefundReturnCondition(input.condition);
  const requestNote =
    input.note == null || input.note.trim() === '' ? null : input.note.trim();
  const requestFingerprint = refundCompletionFingerprint({
    refundRequestId,
    idempotencyKey,
    requestedAmountTwd: parsed.requestedAmountTwd,
    requestedQuantity,
    saleId: input.sale.id,
    originalGrossTwd: input.sale.actualGrossTwd,
    collectionChannel: channel,
    commissionRateSnapshot: input.sale.commissionRateSnapshot,
    commissionAmountSnapshot: input.sale.commissionAmountSnapshot,
    sourceKind: source.kind,
    sourceLineId: source.sourceLineId,
    sourceOrderId: source.sourceOrderId,
    sourceSnapshotLineId: source.sourceSnapshotLineId,
    inventoryAggregateId,
    fulfillmentFact,
    physicalReturnFact,
    disposition,
    condition,
    reason,
    note: requestNote,
  });

  const prior = input.existingCompletions.find((row) => row.idempotencyKey === idempotencyKey);
  if (prior) {
    if (prior.requestFingerprint !== requestFingerprint) {
      throw new Error('同一 idempotencyKey 不可對應不同退款完成內容');
    }
    const currentStatus = parseRefundStatus(input.refundStatus);
    if (currentStatus !== 'completed') {
      throw new Error('已有 committed completion 但 persisted 狀態不是 completed');
    }
    assertCommittedFinancialLinePresent(
      input.existingRefunds,
      prior.committedOutcomeSnapshot.financialReversal.line,
    );
    assertCommittedEffectsProof(input.committedEffectsProof, prior.committedOutcomeSnapshot, {
      refundRequestId,
      idempotencyKey,
      reason,
    });
    return {
      currentPersistedStatus: 'completed',
      proposedNextStatus: null,
      financialReversal: prior.committedOutcomeSnapshot.financialReversal,
      inventoryEffect: prior.committedOutcomeSnapshot.inventoryEffect,
      duplicate: true,
      fingerprint: prior.requestFingerprint,
      requestFingerprint: prior.requestFingerprint,
      source: prior.committedOutcomeSnapshot.source,
      committedOutcomeSnapshot: prior.committedOutcomeSnapshot,
    };
  }

  const currentStatus = parseRefundStatus(input.refundStatus);
  if (currentStatus === 'completed') {
    throw new Error('persisted 已是 completed 但缺少 committed completion');
  }
  if (currentStatus !== 'approved') {
    throw new Error('只有 approved 的退款申請可提出 completed 計畫');
  }

  const financial = applyRefundReversalLine({
    sale: input.sale,
    existingRefunds: input.existingRefunds,
    clientInput: input.clientInput,
    idempotencyKey,
  });
  const ledger = refundReversalLedger(input.sale, financial.line);
  const saleReversal = projectSaleReversalState(input.sale, [
    ...input.existingRefunds,
    financial.line,
  ]);
  const inventory = planRefundInventoryEffect({
    fulfillmentFact,
    physicalReturnFact,
    disposition,
    condition,
    note: input.note,
    qty: input.qty,
    financialQuantity: financial.line.quantity ?? null,
    inventoryAggregateId,
  });
  const financialReversal = {
    line: financial.line,
    ledger,
    saleReversal,
  };
  const committedOutcomeSnapshot: RefundCommittedOutcomeSnapshot = {
    financialReversal,
    inventoryEffect: inventory.effect,
    source,
    commissionReversalSnapshot: financial.line.commissionReversalSnapshot,
    ledgerDirection: ledger.direction,
    ledgerKind: ledger.kind,
    settlementDestination: ledger.settlementDestination,
    settlementStatusAtExecution: input.sale.settlementStatus,
  };
  assertTransition(REFUND_TRANSITIONS, 'approved', 'completed', '退款');
  return {
    currentPersistedStatus: 'approved',
    proposedNextStatus: 'completed',
    financialReversal,
    inventoryEffect: inventory.effect,
    duplicate: false,
    fingerprint: requestFingerprint,
    requestFingerprint,
    source,
    committedOutcomeSnapshot,
  };
}

