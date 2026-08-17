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
  POS_01_REFUND_INVENTORY_POLICY,
  RESTOCK_MODEL,
  RESTOCK_REQUEST_TRANSITIONS,
  SALE_TRANSITIONS,
  SERVER_MUST_RESOLVE_FIELDS,
  SETTLEMENT_TRANSITIONS,
  UNCOLLECTED_PICKUP_POLICY,
  UNPAID_PAYMENT_INTENT_TTL_HOURS,
  applyInventoryOp,
  applyRefundReversalLine,
  assertRefundSourceCompatibleWithChannel,
  assertApprovedSettlementLinesImmutable,
  assertCanTakeFromAvailable,
  assertCompletedFactImmutable,
  assertIntegerPercent,
  assertNonNegativeIntegerUnits,
  assertOriginalSaleImmutable,
  assertPositiveUnits,
  assertRestockCancelPlanConsistent,
  assertServiceStrictlyExceedsVoucher,
  assertTwdInteger,
  assertValidPeriod,
  availableUnits,
  buildSettlementAdjustment,
  canApproveAdjustment,
  canApproveRefund,
  canApproveVoucherCancel,
  canChangeCommissionRate,
  canEditSettlementDraftMetadata,
  canProposeExtraAdjustment,
  canReopenSettlement,
  canRequestRefund,
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
  completeApprovedRefund,
  decideRefundRequest,
  decideUnpaidPaymentExpiry,
  decideVoucherCancellation,
  expiredVoucherRefundsPoints,
  freezeGroomingVoucherExpiresAt,
  fulfillmentInventoryOp,
  groomingVoucherFaceTwd,
  inventoryEffectOfRefund,
  isGroomingVoucherUsable,
  isSettlementLocked,
  isUnpaidPaymentIntentExpired,
  ordinarySaleLedger,
  paidPickupOverdueAction,
  paidReservationAutoExpires,
  paidReservationAutoRefunds,
  paidReservationAutoReleases,
  parseAdjustmentKind,
  parseCollectionChannel,
  parseRefundInventoryDisposition,
  parseRefundReturnCondition,
  parseRefundSourceKind,
  parseFulfillmentStatus,
  parseLedgerDirection,
  parseLedgerKind,
  parsePosActor,
  parseSaleStatus,
  parseVoucherTier,
  planRefundInventoryEffect,
  planRestockCancel,
  projectSaleReversalState,
  refundCompletionFingerprint,
  refundReversalLedger,
  refundableRemainder,
  requestVoucherCancellation,
  restockIncreasesStoreOnHand,
  storeRefundCompletion,
  storeVoucherCancellationDecision,
  roundPercentCommission,
  safeIntegerMul,
  snapshotCompletedSaleLine,
  sumCommissionReversals,
  sumSettlementCommissionSnapshots,
  uncollectedPickupAction,
  unpaidCheckoutReservesInventory,
  voucherRedemptionLedger,
  type CompletedSaleLine,
  type RefundReversalLine,
} from '@/lib/pos/domain-contract';

function completedSale(overrides: Partial<CompletedSaleLine> = {}): CompletedSaleLine {
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

function stockOp(
  overrides: Partial<{
    inventoryAggregateId: string;
    op: 'reserve' | 'release' | 'expire' | 'consume_pickup' | 'consume_in_store';
    qty: number;
    idempotencyKey: string;
    reference: string;
  }> = {},
) {
  return {
    inventoryAggregateId: 'merchant-stock-1',
    op: 'reserve' as const,
    qty: 3,
    idempotencyKey: 'r1',
    ...overrides,
  };
}

describe('POS-01 open decisions must stay undecided', () => {
  it('freezes O1 refund inventory and keeps Zhuwo IDs open', () => {
    assert.equal('refundRestockReason' in POS_01_OPEN_DECISIONS, false);
    assert.equal(POS_01_OPEN_DECISIONS.zhuwoOfficialImmutableIds.status, 'UNDECIDED');
    assert.equal(inventoryEffectOfRefund().id, 'O1');
    assert.equal(inventoryEffectOfRefund().status, 'FROZEN');
    assert.equal(POS_01_REFUND_INVENTORY_POLICY.unfulfilled, 'release_only');
    assert.match(POS_01_OPEN_DECISIONS.zhuwoOfficialImmutableIds.note, /禁止用中文店名/);
    assert.equal('linePaymentReservationTimeout' in POS_01_OPEN_DECISIONS, false);
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
    assert.equal(restockIncreasesStoreOnHand('delivered'), true);
    assert.equal(canTransitionRestockShipment('shipped', 'delivered'), true);
    assert.equal(canTransitionRestockShipment('delivered', 'pending'), false);
  });
});

describe('reservation reserve / release / consume and duplicates', () => {
  it('applies atomic stock effects and returns stored result on same key/payload', () => {
    const reserved = applyInventoryOp(
      { onHand: 10, reserved: 0 },
      stockOp(),
      new Map(),
    );
    assert.deepEqual(reserved.state, { onHand: 10, reserved: 3 });
    assert.equal(reserved.duplicate, false);

    const dup = applyInventoryOp(
      { onHand: 99, reserved: 50 },
      stockOp(),
      reserved.log,
    );
    assert.deepEqual(dup.state, { onHand: 10, reserved: 3 });
    assert.equal(dup.duplicate, true);

    const released = applyInventoryOp(
      reserved.state,
      stockOp({ op: 'release', qty: 1, idempotencyKey: 'rel-1' }),
      reserved.log,
    );
    assert.deepEqual(released.state, { onHand: 10, reserved: 2 });

    const picked = applyInventoryOp(
      released.state,
      stockOp({ op: 'consume_pickup', qty: 2, idempotencyKey: 'pick-1' }),
      released.log,
    );
    assert.deepEqual(picked.state, { onHand: 8, reserved: 0 });

    const storeSale = applyInventoryOp(
      picked.state,
      stockOp({ op: 'consume_in_store', qty: 3, idempotencyKey: 'pos-1' }),
      picked.log,
    );
    assert.deepEqual(storeSale.state, { onHand: 5, reserved: 0 });
  });

  it('throws when the same inventory key is reused with a different op or qty', () => {
    const first = applyInventoryOp(
      { onHand: 10, reserved: 0 },
      stockOp(),
      new Map(),
    );
    assert.throws(
      () =>
        applyInventoryOp(
          first.state,
          stockOp({ op: 'release', qty: 3 }),
          first.log,
        ),
      /不同庫存聚合、操作或數量/,
    );
    assert.throws(
      () =>
        applyInventoryOp(
          first.state,
          stockOp({ qty: 2 }),
          first.log,
        ),
      /不同庫存聚合、操作或數量/,
    );
  });

  it('throws when the same inventory key targets a different aggregate even with same op/qty', () => {
    const first = applyInventoryOp(
      { onHand: 10, reserved: 0 },
      stockOp({ inventoryAggregateId: 'merchant-stock-A' }),
      new Map(),
    );
    assert.throws(
      () =>
        applyInventoryOp(
          { onHand: 10, reserved: 0 },
          stockOp({ inventoryAggregateId: 'merchant-stock-B' }),
          first.log,
        ),
      /不同庫存聚合、操作或數量/,
    );
  });

  it('rejects reserve/release/consume that would go negative or exceed reserved', () => {
    assert.throws(
      () =>
        applyInventoryOp(
          { onHand: 2, reserved: 0 },
          stockOp({ idempotencyKey: 'x' }),
          new Map(),
        ),
      /負庫存/,
    );
    assert.throws(
      () =>
        applyInventoryOp(
          { onHand: 5, reserved: 1 },
          stockOp({ op: 'release', qty: 2, idempotencyKey: 'x' }),
          new Map(),
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
    assert.equal(canTransitionFulfillment('refund_pending', 'refunded'), true);
    assert.equal(fulfillmentInventoryOp('pending_payment', 'paid_reserved'), 'reserve');
    assert.equal(fulfillmentInventoryOp('ready_for_pickup', 'picked_up'), 'consume_pickup');
    assert.equal(fulfillmentInventoryOp('paid_reserved', 'refund_pending'), 'release');
  });

  it('rejects illegal fulfillment jumps', () => {
    assert.equal(canTransitionFulfillment('pending_payment', 'picked_up'), false);
    assert.equal(canTransitionFulfillment('picked_up', 'refund_pending'), false);
    assert.equal(canTransition(FULFILLMENT_TRANSITIONS, 'refunded', 'paid_reserved'), false);
    assert.throws(() => parseFulfillmentStatus('Paid_Reserved'), /allow-list/);
  });
});

describe('unpaid 24h expiry vs paid reservation retention', () => {
  it('expires only unpaid checkout after 24 hours and never auto-expires paid reservations', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const justBefore = new Date(created.getTime() + UNPAID_PAYMENT_INTENT_TTL_HOURS * 3600 * 1000 - 1);
    const atTtl = new Date(created.getTime() + UNPAID_PAYMENT_INTENT_TTL_HOURS * 3600 * 1000);
    assert.equal(UNPAID_PAYMENT_INTENT_TTL_HOURS, 24);
    assert.equal(unpaidCheckoutReservesInventory(), false);
    assert.equal(isUnpaidPaymentIntentExpired(created, justBefore), false);
    assert.equal(decideUnpaidPaymentExpiry('pending_payment', created, justBefore), 'keep');
    assert.equal(decideUnpaidPaymentExpiry('pending_payment', created, atTtl), 'expire');
    assert.equal(canTransitionFulfillment('pending_payment', 'expired'), true);
    assert.equal(canTransitionFulfillment('paid_reserved', 'expired'), false);
    assert.equal(canTransitionFulfillment('ready_for_pickup', 'expired'), false);
    assert.equal(paidReservationAutoExpires(), false);
    assert.equal(paidReservationAutoRefunds(), false);
    assert.equal(paidReservationAutoReleases(), false);
    assert.equal(paidPickupOverdueAction('paid_reserved'), 'contact_support');
    assert.throws(() => decideUnpaidPaymentExpiry('paid_reserved', created, atTtl), /只有未付款/);
  });
});

describe('ledger direction — store collected vs Furmosa collected', () => {
  it('uses opposite directions for the same net sale and rate', () => {
    const store = ordinarySaleLedger('merchant_collected', 1000, 30);
    const line = ordinarySaleLedger('furmosa_collected_line_ecpay', 1000, 30);
    assert.equal(store.direction, 'merchant_owes_hq');
    assert.equal(store.merchantOwesHqTwd, 700);
    assert.equal(line.direction, 'hq_owes_merchant');
    assert.equal(line.hqOwesMerchantTwd, 300);
    assert.notEqual(store.direction, line.direction);
  });
});

describe('partial refund remainder commission and idempotency', () => {
  it('keeps the original completed sale and caps cumulative amount/qty', () => {
    const sale = completedSale();
    assertOriginalSaleImmutable(sale);
    const first = applyRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400, requestedQuantity: 4 },
      idempotencyKey: 'ref-1',
    });
    assert.equal(first.duplicate, false);
    assert.equal(projectSaleReversalState(sale, [first.line]), 'partially_reversed');
    const second = applyRefundReversalLine({
      sale,
      existingRefunds: [first.line],
      clientInput: { requestedAmountTwd: 600, requestedQuantity: 6 },
      idempotencyKey: 'ref-2',
    });
    assert.equal(projectSaleReversalState(sale, [first.line, second.line]), 'fully_reversed');
    assert.equal(sale.status, 'completed');
    assert.throws(
      () =>
        applyRefundReversalLine({
          sale,
          existingRefunds: [first.line],
          clientInput: { requestedAmountTwd: 700 },
          idempotencyKey: 'ref-over',
        }),
      /不可超過原可退餘額/,
    );
  });

  it('lets amount-complete refunds project fully_reversed even if quantity remains', () => {
    const sale = completedSale();
    const refund = applyRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 1000, requestedQuantity: 3 },
      idempotencyKey: 'amt-only',
    });
    assert.equal(projectSaleReversalState(sale, [refund.line]), 'fully_reversed');
    assert.deepEqual(refundableRemainder(sale, [refund.line]), { amountTwd: 0, quantity: 7 });
  });

  it('returns the existing line for the same refund key and payload', () => {
    const sale = completedSale();
    const first = applyRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400, requestedQuantity: 4 },
      idempotencyKey: 'ref-1',
    });
    const dup = applyRefundReversalLine({
      sale,
      existingRefunds: [first.line],
      clientInput: { requestedAmountTwd: 400, requestedQuantity: 4 },
      idempotencyKey: 'ref-1',
    });
    assert.equal(dup.duplicate, true);
    assert.deepEqual(dup.line, first.line);
    assert.equal(projectSaleReversalState(sale, [first.line, dup.line]), 'partially_reversed');
  });

  it('throws when the same refund key has a different payload', () => {
    const sale = completedSale();
    const first = applyRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400 },
      idempotencyKey: 'ref-1',
    });
    assert.throws(
      () =>
        applyRefundReversalLine({
          sale,
          existingRefunds: [first.line],
          clientInput: { requestedAmountTwd: 300 },
          idempotencyKey: 'ref-1',
        }),
      /不同退款內容/,
    );
  });

  it('fails closed when existing refund lines disagree with the sale snapshot or over-reverse commission', () => {
    const sale = completedSale();
    const baseLine: RefundReversalLine = {
      originalSaleId: 'sale-1',
      amountTwd: 100,
      originalCollectionChannel: 'merchant_collected',
      originalCommissionRateSnapshot: 30,
      commissionReversalSnapshot: 30,
      idempotencyKey: 'hist-1',
    };
    assert.throws(
      () =>
        refundableRemainder(sale, [
          { ...baseLine, originalCollectionChannel: 'furmosa_collected_line_ecpay' },
        ]),
      /collection channel 與原 sale snapshot 不一致/,
    );
    assert.throws(
      () =>
        refundableRemainder(sale, [
          { ...baseLine, originalCommissionRateSnapshot: 10 },
        ]),
      /佣金率與原 sale snapshot 不一致/,
    );
    assert.throws(
      () =>
        refundableRemainder(sale, [
          { ...baseLine, commissionReversalSnapshot: 301 },
        ]),
      /既有退款佣金回沖與剩餘淨額公式不一致/,
    );
    assert.throws(
      () =>
        applyRefundReversalLine({
          sale,
          existingRefunds: [
            { ...baseLine, originalCollectionChannel: 'furmosa_collected_line_ecpay' },
          ],
          clientInput: { requestedAmountTwd: 100 },
          idempotencyKey: 'hist-1',
        }),
      /collection channel 與原 sale snapshot 不一致/,
    );
  });

  it('requires existing commission reversals to match the remaining-net formula exactly', () => {
    const sale = completedSale();
    const line = (snapshot: number, key = 'r-100'): RefundReversalLine => ({
      originalSaleId: 'sale-1',
      amountTwd: 100,
      originalCollectionChannel: 'merchant_collected',
      originalCommissionRateSnapshot: 30,
      commissionReversalSnapshot: snapshot,
      idempotencyKey: key,
    });
    assert.throws(() => refundableRemainder(sale, [line(0)]), /既有退款佣金回沖與剩餘淨額公式不一致/);
    assert.throws(() => refundableRemainder(sale, [line(29)]), /既有退款佣金回沖與剩餘淨額公式不一致/);
    const exact = refundableRemainder(sale, [line(30)]);
    assert.equal(exact.amountTwd, 900);
    const first = applyRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400, requestedQuantity: 4 },
      idempotencyKey: 'split-1',
    });
    const second = applyRefundReversalLine({
      sale,
      existingRefunds: [first.line],
      clientInput: { requestedAmountTwd: 600, requestedQuantity: 6 },
      idempotencyKey: 'split-2',
    });
    assert.doesNotThrow(() => refundableRemainder(sale, [first.line, second.line]));
    assert.equal(sumCommissionReversals([first.line, second.line]), 300);
    assert.throws(
      () => refundableRemainder(sale, [line(30), { ...line(29), amountTwd: 100 }]),
      /同一 idempotencyKey 不可對應不同退款內容/,
    );
    assert.throws(
      () =>
        applyRefundReversalLine({
          sale,
          existingRefunds: [line(30), { ...line(29) }],
          clientInput: { requestedAmountTwd: 100 },
          idempotencyKey: 'r-100',
        }),
      /同一 idempotencyKey 不可對應不同退款內容/,
    );
  });

  it('closes commission remainder after two 1-TWD refunds on a 2-TWD 30% sale', () => {
    const sale = completedSale({
      actualGrossTwd: 2,
      quantity: 2,
      commissionAmountSnapshot: 1,
    });
    const lines: RefundReversalLine[] = [];
    for (const [i, amount] of [1, 1].entries()) {
      const applied = applyRefundReversalLine({
        sale,
        existingRefunds: lines,
        clientInput: { requestedAmountTwd: amount },
        idempotencyKey: `r-${i}`,
      });
      lines.push(applied.line);
    }
    assert.equal(sumCommissionReversals(lines), 1);
    assert.equal(projectSaleReversalState(sale, lines), 'fully_reversed');
    assert.equal(sale.commissionAmountSnapshot, 1);
  });

  it('closes commission remainder after five 1-TWD refunds on a 5-TWD 30% sale', () => {
    const sale = completedSale({
      actualGrossTwd: 5,
      quantity: 5,
      commissionAmountSnapshot: 2,
    });
    const lines: RefundReversalLine[] = [];
    for (let i = 0; i < 5; i += 1) {
      const applied = applyRefundReversalLine({
        sale,
        existingRefunds: lines,
        clientInput: { requestedAmountTwd: 1 },
        idempotencyKey: `r-${i}`,
      });
      lines.push(applied.line);
    }
    assert.equal(sumCommissionReversals(lines), 2);
    assert.equal(projectSaleReversalState(sale, lines), 'fully_reversed');
  });

  it('reverses debt and commission in opposite directions per collection channel', () => {
    const storeSale = completedSale({ collectionChannel: 'merchant_collected' });
    const lineSale = completedSale({
      id: 'sale-2',
      collectionChannel: 'furmosa_collected_line_ecpay',
    });
    const storeRefund = applyRefundReversalLine({
      sale: storeSale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400 },
      idempotencyKey: 's',
    }).line;
    const lineRefund = applyRefundReversalLine({
      sale: lineSale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400 },
      idempotencyKey: 'l',
    }).line;
    const storeLedger = refundReversalLedger(storeSale, storeRefund);
    const lineLedger = refundReversalLedger(lineSale, lineRefund);
    assert.equal(storeLedger.direction, 'hq_owes_merchant');
    assert.equal(lineLedger.direction, 'merchant_owes_hq');
    assert.notEqual(storeLedger.direction, lineLedger.direction);
  });

  it('routes refunds on locked settlements to the next period', () => {
    const sale = completedSale({ settlementStatus: 'approved' });
    const refund = applyRefundReversalLine({
      sale,
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 100 },
      idempotencyKey: 'locked',
    }).line;
    const ledger = refundReversalLedger(sale, refund);
    assert.equal(ledger.settlementDestination, 'next_period_adjustment');
    assert.equal(ledger.kind, 'next_period_adjustment');
  });

  it('snapshots each sale line and only sums snapshots at settlement', () => {
    const a = snapshotCompletedSaleLine(1000, 30);
    const b = snapshotCompletedSaleLine(5, 30);
    assert.equal(sumSettlementCommissionSnapshots([a, b]), 302);
  });
});

describe('grooming voucher — 200/250, not a product coupon', () => {
  it('uses explicit face tiers instead of Chinese store names', () => {
    assert.equal(groomingVoucherFaceTwd('standard_200'), GROOMING_VOUCHER_FACE_STANDARD_TWD);
    assert.equal(groomingVoucherFaceTwd('zhuwo_250'), GROOMING_VOUCHER_FACE_ZHUWO_TWD);
    assert.equal(GROOMING_VOUCHER_POINTS, 10);
    assert.equal(GROOMING_VOUCHER_VALIDITY_DAYS, 30);
    assert.equal(GROOMING_VOUCHER_TIME_ZONE, 'Asia/Taipei');
  });

  it('requires service total strictly greater than voucher face', () => {
    assert.doesNotThrow(() => assertServiceStrictlyExceedsVoucher(201, 200));
    assert.throws(() => assertServiceStrictlyExceedsVoucher(200, 200), /嚴格大於/);
  });

  it('posts a fixed subsidy with no ordinary commission', () => {
    const v200 = voucherRedemptionLedger('standard_200');
    assert.equal(v200.kind, 'voucher_fixed_subsidy');
    assert.equal(v200.direction, 'hq_owes_merchant');
    assert.equal(v200.hqOwesMerchantTwd, 200);
    assert.equal(v200.commissionTwd, 0);
  });

  it('approves an unlocked redeemed cancel as a positive merchant_owes_hq reversal', () => {
    const pending = requestVoucherCancellation({
      requestId: 'req-1',
      voucherStatus: 'redeemed',
      actor: 'merchant_staff',
      voucherId: 'v1',
    });
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'other',
          voucherStatus: 'redeemed',
          redemptionId: 'red-1',
          request: pending,
          actor: 'hq',
          decision: 'approved',
          voucherTier: 'standard_200',
          settlementStatus: null,
          reason: 'dispute',
          idempotencyKey: 'vc-1',
          existingResults: [],
        }),
      /必須等於被取消券/,
    );
    const approved = decideVoucherCancellation({
      voucherId: 'v1',
      voucherStatus: 'redeemed',
      redemptionId: 'red-1',
      request: pending,
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'dispute',
      idempotencyKey: 'vc-1',
      existingResults: [],
    });
    assert.equal(approved.voucherStatus, 'cancelled');
    assert.equal(approved.pointsLine?.pointsDelta, 10);
    assert.equal(approved.subsidyLine?.amountTwd, 200);
    assert.equal(approved.subsidyLine?.direction, 'merchant_owes_hq');
    assert.equal(approved.subsidyLine?.kind, 'reversal');
    assert.equal(approved.duplicate, false);
  });

  it('routes locked or paid subsidy cancels to the next period and retries after projection is cancelled', () => {
    const pending = requestVoucherCancellation({
      requestId: 'req-2',
      voucherStatus: 'redeemed',
      actor: 'merchant_owner',
      voucherId: 'v2',
    });
    const approved = decideVoucherCancellation({
      voucherId: 'v2',
      voucherStatus: 'redeemed',
      redemptionId: 'red-2',
      request: pending,
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'zhuwo_250',
      settlementStatus: 'paid',
      reason: 'dispute',
      idempotencyKey: 'vc-2',
      existingResults: [],
    });
    assert.equal(approved.subsidyLine?.amountTwd, 250);
    assert.equal(approved.subsidyLine?.kind, 'next_period_adjustment');
    assert.equal(approved.subsidyLine?.direction, 'merchant_owes_hq');
    const stored = [storeVoucherCancellationDecision('vc-2', approved)];
    const retry = decideVoucherCancellation({
      voucherId: 'v2',
      voucherStatus: 'cancelled',
      redemptionId: 'red-2',
      request: { ...pending, status: 'approved' },
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'zhuwo_250',
      settlementStatus: 'paid',
      reason: 'dispute',
      idempotencyKey: 'vc-2',
      existingResults: stored,
    });
    assert.equal(retry.duplicate, true);
    assert.equal(retry.pointsLine, approved.pointsLine);
    assert.equal(retry.subsidyLine, approved.subsidyLine);
    assert.equal(retry.pointsLine?.pointsDelta, 10);
    assert.equal(retry.subsidyLine?.idempotencyKey, 'vc-2');
    assert.equal(stored.length, 1);
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'v2',
          voucherStatus: 'cancelled',
          redemptionId: 'red-OTHER',
          request: { ...pending, status: 'approved' },
          actor: 'hq',
          decision: 'approved',
          voucherTier: 'zhuwo_250',
          settlementStatus: 'paid',
          reason: 'dispute',
          idempotencyKey: 'vc-2',
          existingResults: stored,
        }),
      /不可對應不同美容券取消內容/,
    );
  });

  it('rejects empty idempotency and identity fields before creating a new cancel decision', () => {
    const pending = requestVoucherCancellation({
      requestId: 'req-empty',
      voucherStatus: 'redeemed',
      actor: 'merchant_owner',
      voucherId: 'v-empty',
    });
    const base = {
      voucherId: 'v-empty',
      voucherStatus: 'redeemed' as const,
      redemptionId: 'red-empty',
      request: pending,
      actor: 'hq',
      decision: 'approved' as const,
      voucherTier: 'standard_200' as const,
      settlementStatus: null,
      reason: 'dispute',
      idempotencyKey: 'vc-empty',
      existingResults: [] as const,
    };
    assert.throws(() => decideVoucherCancellation({ ...base, idempotencyKey: '' }), /idempotencyKey不可為空/);
    assert.throws(() => decideVoucherCancellation({ ...base, idempotencyKey: '   ' }), /idempotencyKey不可為空/);
    assert.throws(
      () => decideVoucherCancellation({ ...base, request: { ...pending, requestId: '  ' } }),
      /requestId不可為空/,
    );
    assert.throws(() => decideVoucherCancellation({ ...base, voucherId: '' }), /voucherId不可為空/);
    assert.throws(() => decideVoucherCancellation({ ...base, redemptionId: '' }), /redemptionId不可為空/);
    assert.throws(() => decideVoucherCancellation({ ...base, reason: ' ' }), /reason不可為空/);
  });

  it('keeps the voucher redeemed when HQ rejects and retries the same reject idempotently', () => {
    const pending = requestVoucherCancellation({
      requestId: 'req-3',
      voucherStatus: 'redeemed',
      actor: 'merchant_owner',
      voucherId: 'v3',
    });
    const rejected = decideVoucherCancellation({
      voucherId: 'v3',
      voucherStatus: 'redeemed',
      redemptionId: 'red-3',
      request: pending,
      actor: 'hq',
      decision: 'rejected',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'no',
      idempotencyKey: 'vc-3',
      existingResults: [],
    });
    assert.equal(rejected.voucherStatus, 'redeemed');
    assert.equal(rejected.requestStatus, 'rejected');
    assert.equal(rejected.pointsLine, null);
    assert.equal(rejected.subsidyLine, null);
    const stored = [storeVoucherCancellationDecision('vc-3', rejected)];
    const retry = decideVoucherCancellation({
      voucherId: 'v3',
      voucherStatus: 'redeemed',
      redemptionId: 'red-3',
      request: { ...pending, status: 'rejected' },
      actor: 'hq',
      decision: 'rejected',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'no',
      idempotencyKey: 'vc-3',
      existingResults: stored,
    });
    assert.equal(retry.duplicate, true);
    assert.equal(retry.voucherStatus, 'redeemed');
    assert.equal(retry.requestStatus, 'rejected');
    assert.equal(retry.pointsLine, null);
    assert.equal(retry.subsidyLine, null);
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'v3',
          voucherStatus: 'redeemed',
          redemptionId: 'red-3',
          request: { ...pending, status: 'rejected' },
          actor: 'hq',
          decision: 'approved',
          voucherTier: 'standard_200',
          settlementStatus: null,
          reason: 'no',
          idempotencyKey: 'vc-3',
          existingResults: stored,
        }),
      /不可對應不同美容券取消內容/,
    );
    assert.equal(canRequestVoucherCancel('merchant_staff'), true);
    assert.equal(canApproveVoucherCancel('hq'), true);
    assert.equal(expiredVoucherRefundsPoints(), false);
    assert.equal(canTransitionVoucher('issued', 'expired'), true);
  });

  it('re-checks HQ on persisted approve and reject retries and never skips auth', () => {
    const pending = requestVoucherCancellation({
      requestId: 'req-auth',
      voucherStatus: 'redeemed',
      actor: 'merchant_owner',
      voucherId: 'v-auth',
    });
    const approved = decideVoucherCancellation({
      voucherId: 'v-auth',
      voucherStatus: 'redeemed',
      redemptionId: 'red-auth',
      request: pending,
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'ok',
      idempotencyKey: 'vc-auth-a',
      existingResults: [],
    });
    const approvedStored = [storeVoucherCancellationDecision('vc-auth-a', approved)];
    const approvedRetry = decideVoucherCancellation({
      voucherId: 'v-auth',
      voucherStatus: 'cancelled',
      redemptionId: 'red-auth',
      request: { ...pending, status: 'approved' },
      actor: 'hq',
      decision: 'approved',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'ok',
      idempotencyKey: 'vc-auth-a',
      existingResults: approvedStored,
    });
    assert.equal(approvedRetry.duplicate, true);
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'v-auth',
          voucherStatus: 'cancelled',
          redemptionId: 'red-auth',
          request: { ...pending, status: 'approved' },
          actor: 'merchant_staff',
          decision: 'approved',
          voucherTier: 'standard_200',
          settlementStatus: null,
          reason: 'ok',
          idempotencyKey: 'vc-auth-a',
          existingResults: approvedStored,
        }),
      /只有 HQ/,
    );
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'v-auth',
          voucherStatus: 'cancelled',
          redemptionId: 'red-auth',
          request: { ...pending, status: 'approved' },
          actor: 'unknown',
          decision: 'approved',
          voucherTier: 'standard_200',
          settlementStatus: null,
          reason: 'ok',
          idempotencyKey: 'vc-auth-a',
          existingResults: approvedStored,
        }),
      /allow-list/,
    );

    const rejected = decideVoucherCancellation({
      voucherId: 'v-auth',
      voucherStatus: 'redeemed',
      redemptionId: 'red-auth',
      request: pending,
      actor: 'hq',
      decision: 'rejected',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'no',
      idempotencyKey: 'vc-auth-r',
      existingResults: [],
    });
    const rejectedStored = [storeVoucherCancellationDecision('vc-auth-r', rejected)];
    const rejectedRetry = decideVoucherCancellation({
      voucherId: 'v-auth',
      voucherStatus: 'redeemed',
      redemptionId: 'red-auth',
      request: { ...pending, status: 'rejected' },
      actor: 'hq',
      decision: 'rejected',
      voucherTier: 'standard_200',
      settlementStatus: null,
      reason: 'no',
      idempotencyKey: 'vc-auth-r',
      existingResults: rejectedStored,
    });
    assert.equal(rejectedRetry.duplicate, true);
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'v-auth',
          voucherStatus: 'redeemed',
          redemptionId: 'red-auth',
          request: { ...pending, status: 'rejected' },
          actor: 'merchant_staff',
          decision: 'rejected',
          voucherTier: 'standard_200',
          settlementStatus: null,
          reason: 'no',
          idempotencyKey: 'vc-auth-r',
          existingResults: rejectedStored,
        }),
      /只有 HQ/,
    );
    assert.throws(
      () =>
        decideVoucherCancellation({
          voucherId: 'v-auth',
          voucherStatus: 'redeemed',
          redemptionId: 'red-auth',
          request: { ...pending, status: 'rejected' },
          actor: 'HQ',
          decision: 'rejected',
          voucherTier: 'standard_200',
          settlementStatus: null,
          reason: 'no',
          idempotencyKey: 'vc-auth-r',
          existingResults: rejectedStored,
        }),
      /allow-list/,
    );
  });

  it('freezes expiresAt at issue time and is usable only while now < expiresAt', () => {
    const issuedAt = new Date('2026-01-01T00:00:00+08:00');
    const expiresAt = freezeGroomingVoucherExpiresAt(issuedAt);
    assert.equal(isGroomingVoucherUsable(issuedAt, expiresAt), true);
    assert.equal(isGroomingVoucherUsable(expiresAt, expiresAt), false);
  });
});

describe('locked settlement — approved is permanent', () => {
  it('allows reviewing to return to draft but never rewrite facts', () => {
    assert.equal(canTransitionSettlement('reviewing', 'draft'), true);
    assert.equal(canTransition(SETTLEMENT_TRANSITIONS, 'reviewing', 'draft'), true);
    assert.equal(canRewriteSettlementFacts('draft'), false);
    assert.equal(canRewriteSettlementFacts('approved'), false);
    assert.equal(canEditSettlementDraftMetadata('hq', 'reviewing'), true);
    assert.equal(canWriteSettlementPaymentMetadata('hq', 'approved'), true);
    assert.throws(() => assertApprovedSettlementLinesImmutable(), /永久鎖定/);
  });

  it('forbids reopen or rewrite after approved', () => {
    assert.equal(isSettlementLocked('approved'), true);
    assert.equal(canReopenSettlement('approved'), false);
    assert.equal(canTransitionSettlement('approved', 'paid'), true);
    assert.equal(correctionForLockedSettlement('approved'), 'next_period_adjustment');
    assert.equal(correctionModeForCompletedFact('settlement'), 'next_period_adjustment');
    assert.throws(() => assertCompletedFactImmutable(), /不可修改或刪除原事實/);
  });

  it('requires positive adjustment amounts and a valid period', () => {
    assert.equal(canChangeCommissionRate('merchant_staff'), false);
    assert.equal(canProposeExtraAdjustment('merchant_owner'), true);
    assert.equal(canApproveAdjustment('hq'), true);
    const adj = buildSettlementAdjustment({
      amountTwd: 150,
      direction: 'hq_owes_merchant',
      reference: 'sale-1',
      reason: 'locked-period refund',
      requestedBy: 'merchant_owner',
      approvedBy: 'hq',
      effectivePeriod: { start: new Date('2026-09-01'), end: new Date('2026-09-30') },
      idempotencyKey: 'adj-1',
      kind: 'next_period_adjustment',
    });
    assert.equal(adj.amountTwd, 150);
    assert.throws(
      () =>
        buildSettlementAdjustment({
          amountTwd: -150,
          direction: 'hq_owes_merchant',
          reference: 'sale-1',
          reason: 'x',
          requestedBy: 'hq',
          approvedBy: 'hq',
          effectivePeriod: { start: new Date('2026-09-01'), end: new Date('2026-09-30') },
          idempotencyKey: 'adj-neg',
          kind: 'next_period_adjustment',
        }),
      /負值/,
    );
    assert.throws(
      () =>
        buildSettlementAdjustment({
          amountTwd: 0,
          direction: 'hq_owes_merchant',
          reference: 'sale-1',
          reason: 'x',
          requestedBy: 'hq',
          approvedBy: 'hq',
          effectivePeriod: { start: new Date('2026-09-01'), end: new Date('2026-09-30') },
          idempotencyKey: 'adj-0',
          kind: 'next_period_adjustment',
        }),
      /大於 0/,
    );
    assert.throws(
      () =>
        buildSettlementAdjustment({
          amountTwd: 10,
          direction: 'hq_owes_merchant',
          reference: 'sale-1',
          reason: 'x',
          requestedBy: 'hq',
          approvedBy: 'hq',
          effectivePeriod: { start: new Date('2026-09-30'), end: new Date('2026-09-01') },
          idempotencyKey: 'adj-period',
          kind: 'next_period_adjustment',
        }),
      /起日必須早於迄日/,
    );
    assert.throws(
      () =>
        buildSettlementAdjustment({
          amountTwd: 10,
          direction: 'hq_owes_merchant',
          reference: 'sale-1',
          reason: 'x',
          requestedBy: 'hq',
          approvedBy: 'hq',
          effectivePeriod: { start: new Date('nope'), end: new Date('2026-09-30') },
          idempotencyKey: 'adj-date',
          kind: 'next_period_adjustment',
        }),
      /不是有效日期/,
    );
    assert.throws(() => parseAdjustmentKind('reversal'), /allow-list/);
    assert.throws(() => parseLedgerKind('unknown'), /allow-list/);
    assert.throws(() => parseLedgerDirection('owe'), /allow-list/);
    assert.throws(() => assertValidPeriod(new Date(Number.NaN), new Date()), /不是有效日期/);
  });
});

describe('unknown channel / tier / actor / status fail closed', () => {
  it('throws on unknown or case-mismatched allow-list values', () => {
    assert.throws(() => parseCollectionChannel('cash'), /allow-list/);
    assert.throws(() => parseCollectionChannel('Merchant_Collected'), /allow-list/);
    assert.throws(() => ordinarySaleLedger('line', 100, 30), /allow-list/);
    assert.throws(() => parseVoucherTier('standard'), /allow-list/);
    assert.throws(() => groomingVoucherFaceTwd('unknown'), /allow-list/);
    assert.throws(() => parsePosActor('HQ'), /allow-list/);
    assert.throws(() => parseSaleStatus('reversed'), /allow-list/);
    assert.throws(() => canTransitionSale('completed', 'reversed'), /allow-list/);
    const unknownSale = {
      ...completedSale(),
      collectionChannel: 'cash',
    } as unknown as CompletedSaleLine;
    assert.throws(() => refundableRemainder(unknownSale, []), /allow-list/);
    const unknownRefund = {
      originalSaleId: 'sale-1',
      amountTwd: 1,
      originalCollectionChannel: 'cash',
      originalCommissionRateSnapshot: 30,
      commissionReversalSnapshot: 0,
      idempotencyKey: 'x',
    } as unknown as RefundReversalLine;
    assert.throws(() => refundableRemainder(completedSale(), [unknownRefund]), /allow-list/);
  });
});

describe('restock approved cannot be rejected; cancel matches allow-list', () => {
  it('uses status transition only when canonical allow-list permits it', () => {
    assert.equal(canTransitionRestockRequest('approved', 'rejected'), false);
    assert.equal(canTransition(RESTOCK_REQUEST_TRANSITIONS, 'approved', 'converted_to_shipment'), true);
    assert.equal(canTransitionRestockRequest('approved', 'cancelled'), false);
    assert.equal(canTransitionRestockRequest('converted_to_shipment', 'cancelled'), false);
    assert.deepEqual(RESTOCK_REQUEST_TRANSITIONS.under_review, ['approved', 'rejected', 'cancelled']);
    assert.equal(canTransitionRestockRequest('under_review', 'cancelled'), true);
    const underReview = planRestockCancel('under_review', null);
    assert.equal(underReview.mode, 'status_transition');
    assert.equal(underReview.requestTo, 'cancelled');
    assertRestockCancelPlanConsistent('under_review', underReview);
    const approved = planRestockCancel('approved', null);
    assert.equal(approved.mode, 'cancellation_event');
    assert.equal(approved.requestTo, null);
    assertRestockCancelPlanConsistent('approved', approved);
    const early = planRestockCancel('submitted', null);
    assert.equal(early.mode, 'status_transition');
    assert.equal(early.requestTo, 'cancelled');
    assert.equal(canTransitionRestockRequest('submitted', 'cancelled'), true);
    assertRestockCancelPlanConsistent('submitted', early);
    const draft = planRestockCancel('draft', null);
    assert.equal(draft.mode, 'status_transition');
    assert.equal(draft.requestTo, 'cancelled');
    assertRestockCancelPlanConsistent('draft', draft);
    const converted = planRestockCancel('converted_to_shipment', 'pending');
    assert.equal(converted.mode, 'cancellation_event');
    assert.equal(converted.requestTo, null);
    assertRestockCancelPlanConsistent('converted_to_shipment', converted);
    const shipped = planRestockCancel('converted_to_shipment', 'packed');
    assert.equal(shipped.mode, 'cancellation_event');
    assert.equal(shipped.shipmentAction, 'cancel_shipment');
    assert.equal(planRestockCancel('converted_to_shipment', 'delivered').allowed, false);
    assert.throws(
      () =>
        assertRestockCancelPlanConsistent('approved', {
          allowed: true,
          mode: 'status_transition',
          requestTo: 'cancelled',
          shipmentAction: 'none',
          reason: '不可改寫 approved',
        }),
      /不一致/,
    );
    assert.throws(
      () =>
        assertRestockCancelPlanConsistent('converted_to_shipment', {
          allowed: true,
          mode: 'status_transition',
          requestTo: 'cancelled',
          shipmentAction: 'cancel_shipment',
          reason: '不可改寫 converted',
        }),
      /不一致/,
    );
  });
});

describe('uncollected pickup and untrusted client fields', () => {
  it('does not auto-refund uncollected paid orders', () => {
    assert.equal(uncollectedPickupAction().autoRefund, false);
    assert.equal(UNCOLLECTED_PICKUP_POLICY.display, 'contact_support');
  });

  it('lists fields the server must resolve and does not claim a source tag is proof', () => {
    for (const field of [
      'merchantId',
      'commission',
      'direction',
      'paymentStatus',
      'voucherAmount',
      'originalSale',
      'inventoryAggregateId',
    ] as const) {
      assert.ok(SERVER_MUST_RESOLVE_FIELDS.includes(field));
    }
    assert.ok(CLIENT_MAY_SUBMIT_BUSINESS_INPUT.includes('actualUnitPriceTwd'));
  });
});

describe('O1 frozen refund inventory policy', () => {
  function completeInput(
    overrides: Record<string, unknown> = {},
  ): Parameters<typeof completeApprovedRefund>[0] {
    return {
      refundRequestId: 'rr-1',
      refundStatus: 'approved',
      actor: 'hq',
      sourceKind: 'pos_sale_line',
      sourceLineId: 'sale-1',
      sale: completedSale(),
      existingRefunds: [],
      clientInput: { requestedAmountTwd: 400, requestedQuantity: 3 },
      idempotencyKey: 'rf-1',
      inventoryAggregateId: 'merchant-stock-1',
      qty: 3,
      fulfillmentFact: 'unfulfilled',
      physicalReturnFact: 'not_returned',
      disposition: 'release_only',
      reason: 'merchant-cancel',
      existingCompletions: [],
      ...overrides,
    };
  }

  it('releases only the reservation for unfulfilled cancels', () => {
    const planned = planRefundInventoryEffect({
      fulfillmentFact: 'unfulfilled',
      physicalReturnFact: 'not_returned',
      disposition: 'release_only',
      qty: 3,
      inventoryAggregateId: 'merchant-stock-1',
    });
    assert.equal(planned.disposition, 'release_only');
    assert.equal(planned.effect?.reservedDelta, -3);
    assert.equal(planned.effect?.onHandDelta, 0);
    assert.equal(planned.effect?.loss, null);
    const completed = completeApprovedRefund(completeInput());
    assert.equal(completed.proposedNextStatus, 'completed');
    assert.equal(completed.persistedRequestStatus, 'approved');
    assert.equal(completed.inventoryEffect?.disposition, 'release_only');
    assert.equal(completed.inventoryEffect?.reservedDelta, -3);
    assert.equal(completed.inventoryEffect?.onHandDelta, 0);
  });

  it('rejects unfulfilled cancels that claim sellable, unsellable, or a physical return', () => {
    assert.throws(
      () =>
        planRefundInventoryEffect({
          fulfillmentFact: 'unfulfilled',
          physicalReturnFact: 'returned',
          disposition: 'release_only',
          qty: 1,
          inventoryAggregateId: 'merchant-stock-1',
        }),
      /未履約取消不可帶實物退回/,
    );
    assert.throws(
      () =>
        planRefundInventoryEffect({
          fulfillmentFact: 'unfulfilled',
          physicalReturnFact: 'not_returned',
          disposition: 'restock_sellable',
          condition: 'unopened_good_sellable',
          qty: 1,
          inventoryAggregateId: 'merchant-stock-1',
        }),
      /未履約取消不可帶實物退回|處置與履約/,
    );
    assert.throws(
      () =>
        planRefundInventoryEffect({
          fulfillmentFact: 'unfulfilled',
          physicalReturnFact: 'not_returned',
          disposition: 'loss_unsellable',
          condition: 'damaged',
          qty: 1,
          inventoryAggregateId: 'merchant-stock-1',
        }),
      /未履約取消不可帶實物退回|處置與履約/,
    );
    assert.throws(
      () =>
        planRefundInventoryEffect({
          fulfillmentFact: 'unfulfilled',
          physicalReturnFact: 'not_returned',
          disposition: 'no_stock_effect',
          qty: 1,
          inventoryAggregateId: 'merchant-stock-1',
        }),
      /處置與履約/,
    );
  });

  it('restocks sellable returned goods after fulfillment', () => {
    const completed = completeApprovedRefund(
      completeInput({
        fulfillmentFact: 'fulfilled',
        physicalReturnFact: 'returned',
        disposition: 'restock_sellable',
        condition: 'unopened_good_sellable',
      }),
    );
    assert.equal(completed.inventoryEffect?.disposition, 'restock_sellable');
    assert.equal(completed.inventoryEffect?.onHandDelta, 3);
    assert.equal(completed.inventoryEffect?.reservedDelta, 0);
    assert.equal(completed.inventoryEffect?.loss, null);
  });

  it('records unsellable returned goods as loss and requires a note for other_unsellable', () => {
    const completed = completeApprovedRefund(
      completeInput({
        fulfillmentFact: 'fulfilled',
        physicalReturnFact: 'returned',
        disposition: 'loss_unsellable',
        condition: 'damaged',
      }),
    );
    assert.equal(completed.inventoryEffect?.disposition, 'loss_unsellable');
    assert.equal(completed.inventoryEffect?.onHandDelta, 0);
    assert.equal(completed.inventoryEffect?.loss?.qty, 3);
    assert.throws(
      () =>
        planRefundInventoryEffect({
          fulfillmentFact: 'fulfilled',
          physicalReturnFact: 'returned',
          disposition: 'loss_unsellable',
          condition: 'other_unsellable',
          note: '   ',
          qty: 1,
          inventoryAggregateId: 'merchant-stock-1',
        }),
      /OTHER_UNSELLABLE 說明不可為空/,
    );
  });

  it('applies no stock effect when fulfilled goods are not returned', () => {
    const completed = completeApprovedRefund(
      completeInput({
        fulfillmentFact: 'fulfilled',
        physicalReturnFact: 'not_returned',
        disposition: 'no_stock_effect',
      }),
    );
    assert.equal(completed.inventoryEffect, null);
    assert.equal(completed.financialReversal.line.amountTwd, 400);
  });

  it('throws on unknown or case-mismatched source, disposition, condition, and status', () => {
    assert.throws(() => parseRefundSourceKind('POS_SALE_LINE'), /allow-list/);
    assert.throws(() => parseRefundInventoryDisposition('Release_Only'), /allow-list/);
    assert.throws(() => parseRefundReturnCondition('DAMAGED'), /allow-list/);
    assert.throws(() => decideRefundRequest({ currentStatus: 'Approved', decision: 'rejected', actor: 'hq' }), /allow-list/);
    assert.throws(
      () => completeApprovedRefund(completeInput({ sourceKind: 'online' })),
      /allow-list/,
    );
  });

  it('rejects invalid refund inventory quantities', () => {
    for (const qty of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3', Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(
        () =>
          planRefundInventoryEffect({
            fulfillmentFact: 'unfulfilled',
            physicalReturnFact: 'not_returned',
            disposition: 'release_only',
            qty,
            inventoryAggregateId: 'merchant-stock-1',
          }),
        /大於 0|安全整數|NaN|Infinity|負值/,
      );
    }
    assert.throws(() => assertPositiveUnits(0, '退款庫存數量'), /大於 0/);
  });

  it('completes only from approved when both financial and inventory plans succeed', () => {
    assert.throws(() => completeApprovedRefund(completeInput({ refundStatus: 'requested' })), /只有 approved/);
    assert.throws(() => completeApprovedRefund(completeInput({ refundStatus: 'rejected' })), /只有 approved/);
    assert.equal(decideRefundRequest({ currentStatus: 'requested', decision: 'approved', actor: 'hq' }).requestStatus, 'approved');
    const completed = completeApprovedRefund(completeInput());
    assert.equal(completed.proposedNextStatus, 'completed');
    assert.equal(completed.persistedRequestStatus, 'approved');
    assert.ok(completed.financialReversal.line);
    assert.ok(completed.inventoryEffect);
  });

  it('treats rejected and completed refunds as terminal, including same-state', () => {
    assert.equal(canTransitionRefund('rejected', 'approved'), false);
    assert.equal(canTransitionRefund('rejected', 'completed'), false);
    assert.equal(canTransitionRefund('rejected', 'rejected'), false);
    assert.equal(canTransitionRefund('completed', 'approved'), false);
    assert.equal(canTransitionRefund('completed', 'completed'), false);
    assert.throws(
      () => decideRefundRequest({ currentStatus: 'rejected', decision: 'approved', actor: 'hq' }),
      /不可由/,
    );
    assert.throws(
      () => decideRefundRequest({ currentStatus: 'completed', decision: 'rejected', actor: 'hq' }),
      /不可由/,
    );
  });

  it('returns the stored completion for the same key and fingerprint and conflicts on any identity change', () => {
    const first = completeApprovedRefund(completeInput());
    const stored = [storeRefundCompletion('rf-1', first)];
    const retry = completeApprovedRefund(completeInput({ existingCompletions: stored, refundStatus: 'approved' }));
    assert.equal(retry.duplicate, true);
    assert.deepEqual(retry.inventoryEffect, first.inventoryEffect);
    assert.deepEqual(retry.financialReversal, first.financialReversal);
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({ existingCompletions: stored, sourceLineId: 'sale-OTHER', sale: completedSale({ id: 'sale-OTHER' }) }),
        ),
      /不同退款完成內容/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(completeInput({ existingCompletions: stored, inventoryAggregateId: 'stock-OTHER' })),
      /不同退款完成內容/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            existingCompletions: stored,
            qty: 2,
            clientInput: { requestedAmountTwd: 400, requestedQuantity: 2 },
          }),
        ),
      /不同退款完成內容/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            existingCompletions: stored,
            fulfillmentFact: 'fulfilled',
            physicalReturnFact: 'not_returned',
            disposition: 'no_stock_effect',
          }),
        ),
      /不同退款完成內容/,
    );
    assert.throws(
      () => completeApprovedRefund(completeInput({ existingCompletions: stored, reason: 'other-reason' })),
      /不同退款完成內容/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            existingCompletions: stored,
            sale: completedSale({ collectionChannel: 'furmosa_collected_line_ecpay' }),
          }),
        ),
      /只能搭配 merchant_collected/,
    );
  });

  it('completes both POS and online snapshot sources without new payment or fulfillment statuses', () => {
    const pos = completeApprovedRefund(completeInput());
    assert.equal(pos.source.kind, 'pos_sale_line');
    assert.equal(pos.source.sourceOrderId, null);
    assert.equal('paymentStatus' in pos, false);
    assert.equal('fulfillmentStatus' in pos, false);
    const onlineSale = completedSale({
      id: 'snap-1',
      collectionChannel: 'furmosa_collected_line_ecpay',
    });
    const online = completeApprovedRefund(
      completeInput({
        sourceKind: 'online_sale_snapshot_line',
        sourceLineId: 'snap-1',
        sourceOrderId: 'order-9',
        sourceSnapshotLineId: 'snap-1',
        sale: onlineSale,
        idempotencyKey: 'rf-online',
      }),
    );
    assert.equal(online.source.kind, 'online_sale_snapshot_line');
    assert.equal(online.source.sourceOrderId, 'order-9');
    assert.equal(online.source.sourceSnapshotLineId, 'snap-1');
    assert.equal('paymentStatus' in online, false);
    assert.equal('fulfillmentStatus' in online, false);
  });

  it('throws when online identity is missing or the source kind does not match', () => {
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            sourceKind: 'online_sale_snapshot_line',
            sourceLineId: 'sale-1',
          }),
        ),
      /sourceOrderId不可為空/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            sourceKind: 'pos_sale_line',
            sourceOrderId: 'order-9',
            sourceSnapshotLineId: 'snap-1',
          }),
        ),
      /不可帶線上/,
    );
  });

  it('keeps locked settlement routing and opposite collection directions', () => {
    const locked = completeApprovedRefund(
      completeInput({
        sale: completedSale({ settlementStatus: 'approved' }),
        idempotencyKey: 'rf-locked',
      }),
    );
    assert.equal(locked.financialReversal.ledger.kind, 'next_period_adjustment');
    assert.equal(locked.financialReversal.ledger.settlementDestination, 'next_period_adjustment');
    const open = completeApprovedRefund(completeInput({ idempotencyKey: 'rf-open' }));
    assert.equal(open.financialReversal.ledger.kind, 'reversal');
    const line = completeApprovedRefund(
      completeInput({
        sourceKind: 'online_sale_snapshot_line',
        sourceLineId: 'snap-1',
        sourceOrderId: 'order-9',
        sourceSnapshotLineId: 'snap-1',
        sale: completedSale({
          id: 'snap-1',
          collectionChannel: 'furmosa_collected_line_ecpay',
        }),
        idempotencyKey: 'rf-line',
      }),
    );
    assert.equal(open.financialReversal.ledger.direction, 'hq_owes_merchant');
    assert.equal(line.financialReversal.ledger.direction, 'merchant_owes_hq');
  });

  it('projects fully_reversed from amount only and does not let leftover quantity block it', () => {
    const amountDone = completeApprovedRefund(
      completeInput({
        clientInput: { requestedAmountTwd: 1000, requestedQuantity: 3 },
        qty: 3,
        idempotencyKey: 'rf-amt',
      }),
    );
    assert.equal(amountDone.financialReversal.saleReversal, 'fully_reversed');
    assert.deepEqual(refundableRemainder(completedSale(), [amountDone.financialReversal.line]), {
      amountTwd: 0,
      quantity: 7,
    });
    const qtyDone = completeApprovedRefund(
      completeInput({
        clientInput: { requestedAmountTwd: 400, requestedQuantity: 10 },
        qty: 10,
        idempotencyKey: 'rf-qty',
      }),
    );
    assert.equal(qtyDone.financialReversal.saleReversal, 'partially_reversed');
    assert.equal(canRequestRefund('merchant_staff'), true);
    assert.equal(canApproveRefund('hq'), true);
    assert.equal(POS_01_REFUND_INVENTORY_POLICY.runtimeAuthNotImplemented, true);
  });

  it('throws when the same completion key changes amount, financial qty, snapshots, or routing', () => {
    const first = completeApprovedRefund(completeInput());
    const stored = [storeRefundCompletion('rf-1', first)];
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            existingCompletions: stored,
            clientInput: { requestedAmountTwd: 300, requestedQuantity: 3 },
          }),
        ),
      /不同退款完成內容/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            existingCompletions: stored,
            sale: completedSale({
              commissionRateSnapshot: 20,
              commissionAmountSnapshot: 200,
            }),
          }),
        ),
      /不同退款完成內容/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            existingCompletions: stored,
            sale: completedSale({ settlementStatus: 'approved' }),
          }),
        ),
      /不同退款完成內容/,
    );
    assert.throws(
      () => completeApprovedRefund(completeInput({ existingCompletions: stored, actor: 'merchant_staff' })),
      /只有 HQ/,
    );
  });

  it('does not let pipe characters in reason or note collide fingerprints', () => {
    const left = refundCompletionFingerprint({
      refundRequestId: 'rr-1',
      idempotencyKey: 'rf-1',
      requestedAmountTwd: 400,
      requestedQuantity: 3,
      saleId: 'sale-1',
      originalGrossTwd: 1000,
      collectionChannel: 'merchant_collected',
      commissionRateSnapshot: 30,
      commissionAmountSnapshot: 300,
      commissionReversalSnapshot: 120,
      settlementStatus: null,
      settlementDestination: 'current_open_period',
      ledgerDirection: 'hq_owes_merchant',
      sourceKind: 'pos_sale_line',
      sourceLineId: 'sale-1',
      sourceOrderId: null,
      sourceSnapshotLineId: null,
      inventoryAggregateId: 'merchant-stock-1',
      fulfillmentFact: 'unfulfilled',
      physicalReturnFact: 'not_returned',
      disposition: 'release_only',
      condition: null,
      reason: 'a|b',
      note: null,
    });
    const right = refundCompletionFingerprint({
      refundRequestId: 'rr-1',
      idempotencyKey: 'rf-1',
      requestedAmountTwd: 400,
      requestedQuantity: 3,
      saleId: 'sale-1',
      originalGrossTwd: 1000,
      collectionChannel: 'merchant_collected',
      commissionRateSnapshot: 30,
      commissionAmountSnapshot: 300,
      commissionReversalSnapshot: 120,
      settlementStatus: null,
      settlementDestination: 'current_open_period',
      ledgerDirection: 'hq_owes_merchant',
      sourceKind: 'pos_sale_line',
      sourceLineId: 'sale-1',
      sourceOrderId: null,
      sourceSnapshotLineId: null,
      inventoryAggregateId: 'merchant-stock-1',
      fulfillmentFact: 'unfulfilled',
      physicalReturnFact: 'not_returned',
      disposition: 'release_only',
      condition: null,
      reason: 'a',
      note: 'b',
    });
    assert.notEqual(left, right);
    assert.match(left, /"reason":"a\\|b"/);
  });

  it('binds disposition qty to the canonical financial quantity and fail-closes mismatches', () => {
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            qty: 2,
            clientInput: { requestedAmountTwd: 400, requestedQuantity: 3 },
          }),
        ),
      /庫存處置數量必須等於本次財務退款數量/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            clientInput: { requestedAmountTwd: 400 },
            qty: 3,
          }),
        ),
      /財務退款數量為空時不可有庫存效果/,
    );
    const amountOnly = completeApprovedRefund(
      completeInput({
        fulfillmentFact: 'fulfilled',
        physicalReturnFact: 'not_returned',
        disposition: 'no_stock_effect',
        clientInput: { requestedAmountTwd: 400 },
        qty: undefined,
        idempotencyKey: 'rf-null-qty',
      }),
    );
    assert.equal(amountOnly.inventoryEffect, null);
    assert.equal(amountOnly.financialReversal.line.quantity, undefined);
    assert.match(amountOnly.fingerprint, /"requestedQuantity":null/);
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            clientInput: { requestedAmountTwd: 400, requestedQuantity: 11 },
            qty: 11,
          }),
        ),
      /不可超過原可退餘額/,
    );
  });

  it('rejects both source and collection-channel mismatches', () => {
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            sale: completedSale({ collectionChannel: 'furmosa_collected_line_ecpay' }),
          }),
        ),
      /pos_sale_line 只能搭配 merchant_collected/,
    );
    assert.throws(
      () =>
        completeApprovedRefund(
          completeInput({
            sourceKind: 'online_sale_snapshot_line',
            sourceLineId: 'snap-1',
            sourceOrderId: 'order-9',
            sourceSnapshotLineId: 'snap-1',
            sale: completedSale({ id: 'snap-1' }),
          }),
        ),
      /online_sale_snapshot_line 只能搭配 furmosa_collected_line_ecpay/,
    );
    assert.throws(
      () => assertRefundSourceCompatibleWithChannel('pos_sale_line', 'furmosa_collected_line_ecpay'),
      /只能搭配 merchant_collected/,
    );
  });

  it('treats the completion plan as proposed, not a persisted completed request', () => {
    const planned = completeApprovedRefund(completeInput());
    assert.equal(planned.persistedRequestStatus, 'approved');
    assert.equal(planned.proposedNextStatus, 'completed');
    assert.equal(planned.duplicate, false);
    const stored = [storeRefundCompletion('rf-1', planned)];
    const retry = completeApprovedRefund(completeInput({ existingCompletions: stored }));
    assert.equal(retry.duplicate, true);
    assert.equal(retry.persistedRequestStatus, 'approved');
    assert.equal(retry.proposedNextStatus, 'completed');
    assert.equal(stored[0].persistedRequestStatus, 'approved');
  });
});

