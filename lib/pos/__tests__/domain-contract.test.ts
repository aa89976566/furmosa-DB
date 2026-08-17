import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLIENT_MAY_SUBMIT_BUSINESS_INPUT,
  FULFILLMENT_TRANSITIONS,
  GROOMING_VOUCHER_FACE_STANDARD_TWD,
  GROOMING_VOUCHER_FACE_ZHUWO_TWD,
  GROOMING_VOUCHER_POINTS,
  GROOMING_VOUCHER_TIME_ZONE,
  GROOMING_VOUCHER_VALIDITY_DAYS,
  PHASE_1_POS_ACCOUNT_POLICY,
  POS_01_OPEN_DECISIONS,
  RESTOCK_MODEL,
  RESTOCK_REQUEST_TRANSITIONS,
  SALE_TRANSITIONS,
  SERVER_MUST_RESOLVE_FIELDS,
  SETTLEMENT_TRANSITIONS,
  UNCOLLECTED_PICKUP_POLICY,
  applyInventoryOp,
  assertApprovedSettlementLinesImmutable,
  assertCanTakeFromAvailable,
  assertCompletedFactImmutable,
  assertIntegerPercent,
  assertNonNegativeIntegerUnits,
  assertOriginalSaleImmutable,
  assertServiceStrictlyExceedsVoucher,
  assertTwdInteger,
  availableUnits,
  buildRefundReversalLine,
  buildSettlementAdjustment,
  canApproveAdjustment,
  canApproveVoucherCancel,
  canChangeCommissionRate,
  canEditSettlementDraftMetadata,
  canProposeExtraAdjustment,
  canReopenSettlement,
  canRequestVoucherCancel,
  canRewriteSettlementFacts,
  canTransition,
  canTransitionFulfillment,
  canTransitionRefund,
  canTransitionReservation,
  canTransitionRestockRequest,
  canTransitionRestockShipment,
  canTransitionSale,
  canTransitionSettlement,
  canTransitionVoucher,
  canWriteSettlementPaymentMetadata,
  correctionForLockedSettlement,
  correctionModeForCompletedFact,
  decideVoucherCancellation,
  expiredVoucherRefundsPoints,
  freezeGroomingVoucherExpiresAt,
  fulfillmentInventoryOp,
  groomingVoucherFaceTwd,
  inventoryEffectOfRefund,
  isGroomingVoucherUsable,
  isSettlementLocked,
  ordinarySaleLedger,
  parseCollectionChannel,
  parseFulfillmentStatus,
  parsePosActor,
  parseSaleStatus,
  parseVoucherTier,
  planRestockCancel,
  projectSaleReversalState,
  refundReversalLedger,
  refundableRemainder,
  requestVoucherCancellation,
  restockIncreasesStoreOnHand,
  roundPercentCommission,
  safeIntegerMul,
  snapshotCompletedSaleLine,
  sumSettlementCommissionSnapshots,
  uncollectedPickupAction,
  voucherRedemptionLedger,
  type CompletedSaleLine,
  type RefundReversalLine,
} from '@/lib/pos/domain-contract';

function completedSale(
  overrides: Partial<CompletedSaleLine> = {},
): CompletedSaleLine {
  return {
    id: 'sale-1',
    status: 'completed',
    actualGrossTwd: 1000,
    quantity: 10,
    collectionChannel: 'merchant_collected',
    commissionRateSnapshot: 30,
    commissionAmountSnapshot: 300,
    settlementStatus: null,
    ...overrides,
  };
}

describe('POS-01 open decisions must stay undecided', () => {
  it('does not guess refund restock, LINE timeout, or Zhuwo IDs', () => {
    assert.equal(POS_01_OPEN_DECISIONS.refundRestockReason.status, 'UNDECIDED');
    assert.equal(POS_01_OPEN_DECISIONS.linePaymentReservationTimeout.status, 'UNDECIDED');
    assert.equal(POS_01_OPEN_DECISIONS.zhuwoOfficialImmutableIds.status, 'UNDECIDED');
    assert.equal(inventoryEffectOfRefund(), 'undecided');
    assert.match(POS_01_OPEN_DECISIONS.zhuwoOfficialImmutableIds.note, /禁止用中文店名/);
  });

  it('records phase-1 one active POS account without sealing future multi-account', () => {
    assert.equal(PHASE_1_POS_ACCOUNT_POLICY.activeAccountsPerPhysicalStore, 1);
    assert.equal(PHASE_1_POS_ACCOUNT_POLICY.schemaMustNotForbidFutureMultiAccount, true);
    assert.equal(RESTOCK_MODEL, 'consignment');
  });
});

describe('money helper — integer TWD only', () => {
  it('rejects NaN, Infinity, Float, negative, and non-numbers', () => {
    assert.throws(() => assertTwdInteger(Number.NaN), /NaN/);
    assert.throws(() => assertTwdInteger(Number.POSITIVE_INFINITY), /Infinity/);
    assert.throws(() => assertTwdInteger(10.5), /安全整數/);
    assert.throws(() => assertTwdInteger(-1), /負值/);
    assert.throws(() => assertTwdInteger('100'), /安全整數/);
    assert.throws(() => assertIntegerPercent(30.5), /安全整數/);
    assert.throws(() => assertIntegerPercent(-5), /0 到 100/);
    assert.throws(() => assertIntegerPercent(101), /0 到 100/);
    assert.throws(() => assertNonNegativeIntegerUnits(-2, '數量'), /負值/);
    assert.throws(() => roundPercentCommission(100.2, 30), /安全整數/);
    assert.throws(() => roundPercentCommission(100, 20.5), /安全整數/);
  });

  it('rounds percent commission at 四捨五入 boundaries', () => {
    assert.equal(roundPercentCommission(1, 30), 0);
    assert.equal(roundPercentCommission(2, 30), 1);
    assert.equal(roundPercentCommission(5, 30), 2);
    assert.equal(roundPercentCommission(1, 50), 1);
    assert.equal(roundPercentCommission(10, 25), 3);
    assert.equal(roundPercentCommission(99, 30), 30);
    assert.equal(roundPercentCommission(15, 20), 3);
    assert.equal(roundPercentCommission(0, 30), 0);
    assert.equal(roundPercentCommission(1000, 30), 300);
  });

  it('throws on commission multiplication overflow', () => {
    assert.throws(() => safeIntegerMul(Number.MAX_SAFE_INTEGER, 30, '佣金'), /安全整數/);
    assert.throws(() => roundPercentCommission(Number.MAX_SAFE_INTEGER, 30), /安全整數/);
    assert.throws(() => roundPercentCommission(Number.MAX_SAFE_INTEGER, 2), /安全整數/);
    const safeGross = Math.floor(Number.MAX_SAFE_INTEGER / 30);
    assert.equal(typeof roundPercentCommission(safeGross, 30), 'number');
  });
});

describe('inventory — available = onHand - reserved, never negative', () => {
  it('computes available and rejects negative results', () => {
    assert.equal(availableUnits(5, 2), 3);
    assert.equal(availableUnits(5, 5), 0);
    assert.throws(() => availableUnits(5, 6), /負庫存/);
    assert.throws(() => availableUnits(-1, 0), /負值/);
    assert.throws(() => availableUnits(5, -1), /負值/);
    assert.throws(() => availableUnits(4.2, 1), /安全整數/);
  });

  it('rejects taking more than available', () => {
    assert.doesNotThrow(() => assertCanTakeFromAvailable(5, 2, 3));
    assert.throws(() => assertCanTakeFromAvailable(5, 2, 4), /負庫存/);
    assert.throws(() => assertCanTakeFromAvailable(5, 0, 6), /負庫存/);
    assert.throws(() => assertCanTakeFromAvailable(5, 2, 0), /大於 0/);
  });

  it('increases store on-hand only when restock shipment is delivered', () => {
    assert.equal(restockIncreasesStoreOnHand('pending'), false);
    assert.equal(restockIncreasesStoreOnHand('packed'), false);
    assert.equal(restockIncreasesStoreOnHand('shipped'), false);
    assert.equal(restockIncreasesStoreOnHand('cancelled'), false);
    assert.equal(restockIncreasesStoreOnHand('delivered'), true);
    assert.equal(canTransitionRestockShipment('shipped', 'delivered'), true);
    assert.equal(canTransitionRestockShipment('delivered', 'pending'), false);
  });
});

describe('reservation reserve / release / consume and duplicates', () => {
  it('applies atomic stock effects and ignores duplicate keys', () => {
    const reserved = applyInventoryOp(
      { onHand: 10, reserved: 0 },
      { op: 'reserve', qty: 3, idempotencyKey: 'r1' },
      new Set(),
    );
    assert.deepEqual(reserved.state, { onHand: 10, reserved: 3 });
    assert.equal(reserved.duplicate, false);

    const dup = applyInventoryOp(
      reserved.state,
      { op: 'reserve', qty: 3, idempotencyKey: 'r1' },
      reserved.appliedKeys,
    );
    assert.deepEqual(dup.state, { onHand: 10, reserved: 3 });
    assert.equal(dup.duplicate, true);

    const released = applyInventoryOp(
      reserved.state,
      { op: 'release', qty: 1, idempotencyKey: 'rel-1' },
      reserved.appliedKeys,
    );
    assert.deepEqual(released.state, { onHand: 10, reserved: 2 });

    const picked = applyInventoryOp(
      released.state,
      { op: 'consume_pickup', qty: 2, idempotencyKey: 'pick-1' },
      released.appliedKeys,
    );
    assert.deepEqual(picked.state, { onHand: 8, reserved: 0 });

    const storeSale = applyInventoryOp(
      picked.state,
      { op: 'consume_in_store', qty: 3, idempotencyKey: 'pos-1' },
      picked.appliedKeys,
    );
    assert.deepEqual(storeSale.state, { onHand: 5, reserved: 0 });
  });

  it('rejects reserve/release/consume that would go negative or exceed reserved', () => {
    assert.throws(
      () =>
        applyInventoryOp(
          { onHand: 2, reserved: 0 },
          { op: 'reserve', qty: 3, idempotencyKey: 'x' },
          new Set(),
        ),
      /負庫存/,
    );
    assert.throws(
      () =>
        applyInventoryOp(
          { onHand: 5, reserved: 1 },
          { op: 'release', qty: 2, idempotencyKey: 'x' },
          new Set(),
        ),
      /不可超過已保留量/,
    );
    assert.throws(
      () =>
        applyInventoryOp(
          { onHand: 5, reserved: 1 },
          { op: 'consume_pickup', qty: 2, idempotencyKey: 'x' },
          new Set(),
        ),
      /不可超過已保留量/,
    );
  });
});

describe('duplicate and illegal state transitions', () => {
  it('rejects repeating the same status', () => {
    assert.equal(canTransitionSale('completed', 'completed'), false);
    assert.equal(canTransition(SALE_TRANSITIONS, 'draft', 'draft'), false);
    assert.equal(canTransitionReservation('consumed', 'consumed'), false);
    assert.equal(canTransitionSettlement('approved', 'approved'), false);
    assert.equal(canTransitionVoucher('redeemed', 'redeemed'), false);
    assert.equal(canTransitionRefund('completed', 'completed'), false);
  });

  it('never rewrites a completed sale status', () => {
    assert.equal(canTransitionSale('completed', 'cancelled'), false);
    assert.equal(canTransitionSale('completed', 'draft'), false);
    assert.equal(canTransitionSale('draft', 'completed'), true);
  });

  it('rejects illegal rewrites of completed facts', () => {
    assert.equal(canTransitionSale('cancelled', 'draft'), false);
    assert.equal(canTransitionRefund('completed', 'requested'), false);
    assert.equal(canTransitionReservation('consumed', 'reserved'), false);
    assert.equal(canTransitionVoucher('expired', 'issued'), false);
    assert.equal(canTransitionSettlement('approved', 'reviewing'), false);
    assert.equal(canTransitionSettlement('approved', 'draft'), false);
    assert.equal(canTransitionSettlement('paid', 'approved'), false);
  });
});

describe('fulfillment legal and illegal transitions', () => {
  it('allows the LINE pickup happy path and paid refund path', () => {
    assert.equal(canTransitionFulfillment('pending_payment', 'paid_reserved'), true);
    assert.equal(canTransitionFulfillment('paid_reserved', 'ready_for_pickup'), true);
    assert.equal(canTransitionFulfillment('ready_for_pickup', 'picked_up'), true);
    assert.equal(canTransitionFulfillment('pending_payment', 'expired'), true);
    assert.equal(canTransitionFulfillment('pending_payment', 'cancelled'), true);
    assert.equal(canTransitionFulfillment('paid_reserved', 'refund_pending'), true);
    assert.equal(canTransitionFulfillment('ready_for_pickup', 'refund_pending'), true);
    assert.equal(canTransitionFulfillment('refund_pending', 'refunded'), true);
    assert.equal(fulfillmentInventoryOp('pending_payment', 'paid_reserved'), 'reserve');
    assert.equal(fulfillmentInventoryOp('ready_for_pickup', 'picked_up'), 'consume_pickup');
    assert.equal(fulfillmentInventoryOp('paid_reserved', 'refund_pending'), 'release');
  });

  it('rejects illegal fulfillment jumps', () => {
    assert.equal(canTransitionFulfillment('pending_payment', 'picked_up'), false);
    assert.equal(canTransitionFulfillment('pending_payment', 'refunded'), false);
    assert.equal(canTransitionFulfillment('picked_up', 'refund_pending'), false);
    assert.equal(canTransition(FULFILLMENT_TRANSITIONS, 'refunded', 'paid_reserved'), false);
    assert.throws(() => parseFulfillmentStatus('Paid_Reserved'), /allow-list/);
  });
});

describe('ledger direction — store collected vs Furmosa collected', () => {
  it('uses opposite directions for the same net sale and rate', () => {
    const store = ordinarySaleLedger('merchant_collected', 1000, 30);
    const line = ordinarySaleLedger('furmosa_collected_line_ecpay', 1000, 30);

    assert.equal(store.kind, 'ordinary_commission');
    assert.equal(line.kind, 'ordinary_commission');
    assert.equal(store.commissionTwd, 300);
    assert.equal(line.commissionTwd, 300);
    assert.equal(store.direction, 'merchant_owes_hq');
    assert.equal(store.merchantOwesHqTwd, 700);
    assert.equal(store.hqOwesMerchantTwd, 0);
    assert.equal(line.direction, 'hq_owes_merchant');
    assert.equal(line.hqOwesMerchantTwd, 300);
    assert.equal(line.merchantOwesHqTwd, 0);
    assert.notEqual(store.direction, line.direction);
  });

  it('still pays ordinary commission on LINE/ECPay collected orders', () => {
    const line = ordinarySaleLedger('furmosa_collected_line_ecpay', 5, 30);
    assert.equal(line.commissionTwd, 2);
    assert.equal(line.direction, 'hq_owes_merchant');
  });
});

describe('partial refund cumulative cap and opposite clawback', () => {
  it('keeps the original completed sale and caps cumulative amount/qty', () => {
    const sale = completedSale();
    assertOriginalSaleImmutable(sale);
    assert.equal(canTransitionSale('completed', 'completed'), false);

    const first = buildRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400, requestedQuantity: 4 },
      idempotencyKey: 'ref-1',
    });
    assert.equal(projectSaleReversalState(sale, [first]), 'partially_reversed');
    assert.deepEqual(refundableRemainder(sale, [first]), { amountTwd: 600, quantity: 6 });

    const second = buildRefundReversalLine({
      sale,
      existingRefunds: [first],
      clientInput: { requestedAmountTwd: 600, requestedQuantity: 6 },
      idempotencyKey: 'ref-2',
    });
    assert.equal(projectSaleReversalState(sale, [first, second]), 'fully_reversed');
    assert.equal(sale.status, 'completed');

    assert.throws(
      () =>
        buildRefundReversalLine({
          sale,
          existingRefunds: [first],
          clientInput: { requestedAmountTwd: 700 },
          idempotencyKey: 'ref-over',
        }),
      /不可超過原可退餘額/,
    );
  });

  it('reverses debt and commission in opposite directions per collection channel', () => {
    const storeSale = completedSale({ collectionChannel: 'merchant_collected' });
    const lineSale = completedSale({
      id: 'sale-2',
      collectionChannel: 'furmosa_collected_line_ecpay',
    });
    const storeRefund: RefundReversalLine = {
      originalSaleId: 'sale-1',
      amountTwd: 400,
      originalCollectionChannel: 'merchant_collected',
      originalCommissionRateSnapshot: 30,
      idempotencyKey: 's',
    };
    const lineRefund: RefundReversalLine = {
      originalSaleId: 'sale-2',
      amountTwd: 400,
      originalCollectionChannel: 'furmosa_collected_line_ecpay',
      originalCommissionRateSnapshot: 30,
      idempotencyKey: 'l',
    };
    const storeLedger = refundReversalLedger(storeSale, storeRefund);
    const lineLedger = refundReversalLedger(lineSale, lineRefund);
    assert.equal(storeLedger.commissionTwd, 120);
    assert.equal(lineLedger.commissionTwd, 120);
    assert.equal(storeLedger.direction, 'hq_owes_merchant');
    assert.equal(storeLedger.hqOwesMerchantTwd, 280);
    assert.equal(lineLedger.direction, 'merchant_owes_hq');
    assert.equal(lineLedger.merchantOwesHqTwd, 120);
    assert.notEqual(storeLedger.direction, lineLedger.direction);
    assert.notEqual(storeLedger.direction, ordinarySaleLedger('merchant_collected', 1000, 30).direction);
  });

  it('routes refunds on locked settlements to the next period', () => {
    const sale = completedSale({ settlementStatus: 'approved' });
    const refund: RefundReversalLine = {
      originalSaleId: 'sale-1',
      amountTwd: 100,
      originalCollectionChannel: 'merchant_collected',
      originalCommissionRateSnapshot: 30,
      idempotencyKey: 'locked',
    };
    const ledger = refundReversalLedger(sale, refund);
    assert.equal(ledger.settlementDestination, 'next_period_adjustment');
    assert.equal(ledger.kind, 'next_period_adjustment');
    assert.equal(refundReversalLedger(completedSale(), refund).settlementDestination, 'current_open_period');
  });

  it('snapshots each sale line and only sums snapshots at settlement', () => {
    const a = snapshotCompletedSaleLine(1000, 30);
    const b = snapshotCompletedSaleLine(5, 30);
    assert.equal(a.commissionAmountSnapshot, 300);
    assert.equal(b.commissionAmountSnapshot, 2);
    assert.equal(sumSettlementCommissionSnapshots([a, b]), 302);
  });
});

describe('grooming voucher — 200/250, not a product coupon', () => {
  it('uses explicit face tiers instead of Chinese store names', () => {
    assert.equal(groomingVoucherFaceTwd('standard_200'), GROOMING_VOUCHER_FACE_STANDARD_TWD);
    assert.equal(groomingVoucherFaceTwd('zhuwo_250'), GROOMING_VOUCHER_FACE_ZHUWO_TWD);
    assert.equal(GROOMING_VOUCHER_FACE_STANDARD_TWD, 200);
    assert.equal(GROOMING_VOUCHER_FACE_ZHUWO_TWD, 250);
    assert.equal(GROOMING_VOUCHER_POINTS, 10);
    assert.equal(GROOMING_VOUCHER_VALIDITY_DAYS, 30);
    assert.equal(GROOMING_VOUCHER_TIME_ZONE, 'Asia/Taipei');
  });

  it('requires service total strictly greater than voucher face', () => {
    assert.doesNotThrow(() => assertServiceStrictlyExceedsVoucher(201, 200));
    assert.doesNotThrow(() => assertServiceStrictlyExceedsVoucher(251, 250));
    assert.throws(() => assertServiceStrictlyExceedsVoucher(200, 200), /嚴格大於/);
    assert.throws(() => assertServiceStrictlyExceedsVoucher(250, 250), /嚴格大於/);
    assert.throws(() => assertServiceStrictlyExceedsVoucher(199, 200), /嚴格大於/);
    assert.throws(() => assertServiceStrictlyExceedsVoucher(249, 250), /嚴格大於/);
  });

  it('posts a fixed subsidy with no ordinary commission', () => {
    const v200 = voucherRedemptionLedger('standard_200');
    const v250 = voucherRedemptionLedger('zhuwo_250');
    assert.equal(v200.kind, 'voucher_fixed_subsidy');
    assert.equal(v200.direction, 'hq_owes_merchant');
    assert.equal(v200.commissionTwd, 0);
    assert.equal(v200.hqOwesMerchantTwd, 200);
    assert.equal(v250.hqOwesMerchantTwd, 250);
    assert.notEqual(v200.kind, 'ordinary_commission');
  });

  it('approves a redeemed-only cancel with subsidy reversal and +10 points', () => {
    assert.throws(
      () => requestVoucherCancellation({ voucherStatus: 'issued', actor: 'merchant_staff', voucherId: 'v1' }),
      /已核銷/,
    );
    const pending = requestVoucherCancellation({
      voucherStatus: 'redeemed',
      actor: 'merchant_staff',
      voucherId: 'v1',
    });
    assert.equal(pending.status, 'pending');
    const approved = decideVoucherCancellation({
      voucherStatus: 'redeemed',
      request: pending,
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'standard_200',
    });
    assert.equal(approved.voucherStatus, 'cancelled');
    assert.equal(approved.pointsDelta, 10);
    assert.equal(approved.subsidyReversalTwd, -200);
    const approved250 = decideVoucherCancellation({
      voucherStatus: 'redeemed',
      request: pending,
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'zhuwo_250',
    });
    assert.equal(approved250.subsidyReversalTwd, -250);
  });

  it('keeps the voucher redeemed when HQ rejects the cancel request', () => {
    const pending = requestVoucherCancellation({
      voucherStatus: 'redeemed',
      actor: 'merchant_owner',
      voucherId: 'v2',
    });
    const rejected = decideVoucherCancellation({
      voucherStatus: 'redeemed',
      request: pending,
      actor: 'hq',
      decision: 'rejected',
      voucherTier: 'standard_200',
    });
    assert.equal(rejected.voucherStatus, 'redeemed');
    assert.equal(rejected.pointsDelta, 0);
    assert.equal(rejected.subsidyReversalTwd, 0);
    assert.equal(canRequestVoucherCancel('merchant_staff'), true);
    assert.equal(canApproveVoucherCancel('merchant_staff'), false);
    assert.equal(canApproveVoucherCancel('hq'), true);
    assert.equal(expiredVoucherRefundsPoints(), false);
    assert.equal(canTransitionVoucher('issued', 'expired'), true);
    assert.throws(() => canTransitionVoucher('redeemed', 'cancel_requested'), /allow-list/);
  });

  it('freezes expiresAt at issue time and is usable only while now < expiresAt', () => {
    const issuedAt = new Date('2026-01-01T00:00:00+08:00');
    const expiresAt = freezeGroomingVoucherExpiresAt(issuedAt);
    assert.equal(isGroomingVoucherUsable(issuedAt, expiresAt), true);
    assert.equal(isGroomingVoucherUsable(new Date(expiresAt.getTime() - 1), expiresAt), true);
    assert.equal(isGroomingVoucherUsable(expiresAt, expiresAt), false);
    assert.equal(isGroomingVoucherUsable(new Date(expiresAt.getTime() + 1), expiresAt), false);
  });
});

describe('locked settlement — approved is permanent', () => {
  it('allows reviewing to return to draft but never rewrite facts', () => {
    assert.equal(canTransitionSettlement('reviewing', 'draft'), true);
    assert.equal(canTransition(SETTLEMENT_TRANSITIONS, 'reviewing', 'draft'), true);
    assert.equal(canRewriteSettlementFacts('draft'), false);
    assert.equal(canRewriteSettlementFacts('reviewing'), false);
    assert.equal(canRewriteSettlementFacts('approved'), false);
    assert.equal(canEditSettlementDraftMetadata('hq', 'reviewing'), true);
    assert.equal(canEditSettlementDraftMetadata('hq', 'approved'), false);
    assert.equal(canWriteSettlementPaymentMetadata('hq', 'approved'), true);
    assert.throws(() => assertApprovedSettlementLinesImmutable(), /永久鎖定/);
  });

  it('forbids reopen or rewrite after approved', () => {
    assert.equal(isSettlementLocked('approved'), true);
    assert.equal(isSettlementLocked('paid'), true);
    assert.equal(isSettlementLocked('draft'), false);
    assert.equal(canReopenSettlement('approved'), false);
    assert.equal(canReopenSettlement('paid'), false);
    assert.equal(canTransitionSettlement('approved', 'reviewing'), false);
    assert.equal(canTransitionSettlement('approved', 'paid'), true);
    assert.equal(correctionForLockedSettlement('approved'), 'next_period_adjustment');
    assert.equal(correctionModeForCompletedFact('settlement'), 'next_period_adjustment');
    assert.equal(correctionModeForCompletedFact('sale'), 'reversal');
    assert.throws(() => assertCompletedFactImmutable(), /不可修改或刪除原事實/);
  });

  it('blocks staff from changing commission or settlement and requires adjustment fields', () => {
    assert.equal(canChangeCommissionRate('merchant_staff'), false);
    assert.equal(canChangeCommissionRate('merchant_owner'), false);
    assert.equal(canChangeCommissionRate('hq'), true);
    assert.equal(canProposeExtraAdjustment('merchant_staff'), false);
    assert.equal(canProposeExtraAdjustment('merchant_owner'), true);
    assert.equal(canApproveAdjustment('merchant_owner'), false);
    assert.equal(canApproveAdjustment('hq'), true);
    const adj = buildSettlementAdjustment({
      amountTwd: -150,
      direction: 'hq_owes_merchant',
      reference: 'sale-1',
      reason: 'locked-period refund',
      requestedBy: 'merchant_owner',
      approvedBy: 'hq',
      effectivePeriod: { start: new Date('2026-09-01'), end: new Date('2026-09-30') },
      idempotencyKey: 'adj-1',
      kind: 'next_period_adjustment',
    });
    assert.equal(adj.amountTwd, -150);
    assert.equal(adj.kind, 'next_period_adjustment');
  });
});

describe('unknown channel / tier / actor / status fail closed', () => {
  it('throws on unknown or case-mismatched allow-list values', () => {
    assert.throws(() => parseCollectionChannel('cash'), /allow-list/);
    assert.throws(() => parseCollectionChannel('Merchant_Collected'), /allow-list/);
    assert.throws(() => ordinarySaleLedger('line', 100, 30), /allow-list/);
    assert.throws(() => parseVoucherTier('standard'), /allow-list/);
    assert.throws(() => parseVoucherTier('ZHUWO_250'), /allow-list/);
    assert.throws(() => groomingVoucherFaceTwd('unknown'), /allow-list/);
    assert.throws(() => voucherRedemptionLedger(200), /allow-list/);
    assert.throws(() => parsePosActor('HQ'), /allow-list/);
    assert.throws(() => parsePosActor('admin'), /allow-list/);
    assert.throws(() => parseSaleStatus('reversed'), /allow-list/);
    assert.throws(() => parseSaleStatus('Completed'), /allow-list/);
    assert.throws(() => canTransitionSale('completed', 'reversed'), /allow-list/);
    assert.throws(() => canChangeCommissionRate('staff'), /allow-list/);
  });
});

describe('restock approved cannot be rejected; cancel is independent', () => {
  it('blocks approved → rejected and plans shipment-aware cancel', () => {
    assert.equal(canTransitionRestockRequest('approved', 'rejected'), false);
    assert.equal(canTransition(RESTOCK_REQUEST_TRANSITIONS, 'approved', 'converted_to_shipment'), true);
    assert.equal(planRestockCancel('approved', null).allowed, true);
    assert.equal(planRestockCancel('converted_to_shipment', 'packed').shipmentAction, 'cancel_shipment');
    assert.equal(planRestockCancel('converted_to_shipment', 'delivered').allowed, false);
  });
});

describe('uncollected pickup and untrusted client fields', () => {
  it('does not auto-refund uncollected orders', () => {
    assert.deepEqual(uncollectedPickupAction(), {
      autoRefund: false,
      display: 'contact_support',
    });
    assert.equal(UNCOLLECTED_PICKUP_POLICY.autoRefund, false);
  });

  it('lists fields the server must resolve and does not claim a source tag is proof', () => {
    for (const field of [
      'merchantId',
      'commission',
      'direction',
      'paymentStatus',
      'voucherAmount',
      'originalSale',
    ] as const) {
      assert.ok(SERVER_MUST_RESOLVE_FIELDS.includes(field));
    }
    assert.ok(CLIENT_MAY_SUBMIT_BUSINESS_INPUT.includes('actualUnitPriceTwd'));
    assert.ok(CLIENT_MAY_SUBMIT_BUSINESS_INPUT.includes('requestedAmountTwd'));
  });
});

