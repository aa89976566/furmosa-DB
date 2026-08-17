import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GROOMING_VOUCHER_FACE_STANDARD_TWD,
  GROOMING_VOUCHER_FACE_ZHUWO_TWD,
  GROOMING_VOUCHER_POINTS,
  GROOMING_VOUCHER_VALIDITY_DAYS,
  PHASE_1_POS_ACCOUNT_POLICY,
  POS_01_OPEN_DECISIONS,
  REFUND_TRANSITIONS,
  RESERVATION_TRANSITIONS,
  RESTOCK_MODEL,
  RESTOCK_SHIPMENT_TRANSITIONS,
  SALE_TRANSITIONS,
  SETTLEMENT_TRANSITIONS,
  UNCOLLECTED_PICKUP_POLICY,
  UNTRUSTED_CLIENT_FIELDS,
  VOUCHER_TRANSITIONS,
  assertCanTakeFromAvailable,
  assertCompletedFactImmutable,
  assertIntegerPercent,
  assertServiceStrictlyExceedsVoucher,
  assertTwdInteger,
  assertVoucherCancelByHq,
  availableUnits,
  canApproveAdjustment,
  canApproveVoucherCancel,
  canChangeCommissionRate,
  canMutateSettlement,
  canProposeExtraAdjustment,
  canReopenSettlement,
  canRequestVoucherCancel,
  canRewriteSettlementFacts,
  canTransition,
  canTransitionRefund,
  canTransitionReservation,
  canTransitionRestockShipment,
  canTransitionSale,
  canTransitionSettlement,
  canTransitionVoucher,
  correctionForLockedSettlement,
  correctionModeForCompletedFact,
  expiredVoucherRefundsPoints,
  groomingVoucherFaceTwd,
  inventoryEffectOfRefund,
  isSettlementLocked,
  isUntrustedClientField,
  ordinarySaleLedger,
  requireServerResolved,
  restockIncreasesStoreOnHand,
  roundPercentCommission,
  uncollectedPickupAction,
  voucherRedemptionLedger,
} from '@/lib/pos/domain-contract';

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
    assert.throws(() => assertTwdInteger(10.5), /Float/);
    assert.throws(() => assertTwdInteger(-1), /負值/);
    assert.throws(() => assertTwdInteger('100'), /整數台幣/);
    assert.throws(() => assertIntegerPercent(30.5), /Float/);
    assert.throws(() => assertIntegerPercent(-5), /0 到 100/);
    assert.throws(() => assertIntegerPercent(101), /0 到 100/);
    assert.throws(() => roundPercentCommission(100.2, 30), /Float/);
    assert.throws(() => roundPercentCommission(100, 20.5), /Float/);
  });

  it('rounds percent commission at 四捨五入 boundaries', () => {
    assert.equal(roundPercentCommission(1, 30), 0); // 0.3
    assert.equal(roundPercentCommission(2, 30), 1); // 0.6
    assert.equal(roundPercentCommission(5, 30), 2); // 1.5
    assert.equal(roundPercentCommission(1, 50), 1); // 0.5
    assert.equal(roundPercentCommission(10, 25), 3); // 2.5
    assert.equal(roundPercentCommission(99, 30), 30); // 29.7
    assert.equal(roundPercentCommission(15, 20), 3); // exact
    assert.equal(roundPercentCommission(0, 30), 0);
    assert.equal(roundPercentCommission(1000, 30), 300);
  });
});

describe('inventory — available = onHand - reserved, never negative', () => {
  it('computes available and rejects negative results', () => {
    assert.equal(availableUnits(5, 2), 3);
    assert.equal(availableUnits(5, 5), 0);
    assert.throws(() => availableUnits(5, 6), /負庫存/);
    assert.throws(() => availableUnits(-1, 0), /負值/);
    assert.throws(() => availableUnits(5, -1), /負值/);
    assert.throws(() => availableUnits(4.2, 1), /Float/);
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
    assert.equal(canTransition(RESTOCK_SHIPMENT_TRANSITIONS, 'shipped', 'delivered'), true);
    assert.equal(canTransitionRestockShipment('delivered', 'pending'), false);
  });
});

describe('duplicate and illegal state transitions', () => {
  it('rejects repeating the same status', () => {
    assert.equal(canTransitionSale('completed', 'completed'), false);
    assert.equal(canTransition(SALE_TRANSITIONS, 'draft', 'draft'), false);
    assert.equal(canTransitionReservation('consumed', 'consumed'), false);
    assert.equal(canTransition(RESERVATION_TRANSITIONS, 'reserved', 'reserved'), false);
    assert.equal(canTransitionSettlement('approved', 'approved'), false);
    assert.equal(canTransitionVoucher('redeemed', 'redeemed'), false);
    assert.equal(canTransitionRefund('completed', 'completed'), false);
  });

  it('rejects illegal rewrites of completed facts', () => {
    assert.equal(canTransitionSale('completed', 'draft'), false);
    assert.equal(canTransitionSale('cancelled', 'draft'), false);
    assert.equal(canTransition(REFUND_TRANSITIONS, 'completed', 'requested'), false);
    assert.equal(canTransitionReservation('consumed', 'reserved'), false);
    assert.equal(canTransitionVoucher('expired', 'issued'), false);
    assert.equal(canTransitionSettlement('approved', 'reviewing'), false);
    assert.equal(canTransitionSettlement('approved', 'draft'), false);
    assert.equal(canTransitionSettlement('paid', 'approved'), false);
    assert.equal(canTransition(SETTLEMENT_TRANSITIONS, 'paid', 'draft'), false);
  });

  it('allows only the documented happy paths', () => {
    assert.equal(canTransitionSale('draft', 'completed'), true);
    assert.equal(canTransitionSale('completed', 'reversed'), true);
    assert.equal(canTransitionReservation('reserved', 'consumed'), true);
    assert.equal(canTransitionVoucher('issued', 'redeemed'), true);
    assert.equal(canTransitionSettlement('reviewing', 'approved'), true);
    assert.equal(canTransitionSettlement('approved', 'paid'), true);
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
    assert.equal(line.commissionTwd, 2); // 1.5 → 2
    assert.equal(line.direction, 'hq_owes_merchant');
    assert.equal(line.kind, 'ordinary_commission');
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
    const v200 = voucherRedemptionLedger(200);
    const v250 = voucherRedemptionLedger(250);
    assert.equal(v200.kind, 'voucher_fixed_subsidy');
    assert.equal(v200.direction, 'hq_owes_merchant');
    assert.equal(v200.commissionTwd, 0);
    assert.equal(v200.hqOwesMerchantTwd, 200);
    assert.equal(v250.hqOwesMerchantTwd, 250);
    assert.notEqual(v200.kind, 'ordinary_commission');
    assert.throws(() => voucherRedemptionLedger(180), /200 或 250/);
  });

  it('lets merchant request cancel and only HQ approve; expiry does not refund points', () => {
    assert.equal(canTransition(VOUCHER_TRANSITIONS, 'redeemed', 'cancel_requested'), true);
    assert.equal(canTransitionVoucher('cancel_requested', 'cancelled'), true);
    assert.equal(canRequestVoucherCancel('merchant_staff'), true);
    assert.equal(canApproveVoucherCancel('merchant_staff'), false);
    assert.equal(canApproveVoucherCancel('merchant_owner'), false);
    assert.equal(canApproveVoucherCancel('hq'), true);
    assert.doesNotThrow(() => assertVoucherCancelByHq('hq', 'cancel_requested', 'cancelled'));
    assert.throws(
      () => assertVoucherCancelByHq('merchant_staff', 'cancel_requested', 'cancelled'),
      /只有 HQ/,
    );
    assert.equal(expiredVoucherRefundsPoints(), false);
    assert.equal(canTransitionVoucher('issued', 'expired'), true);
  });
});

describe('locked settlement — approved is permanent', () => {
  it('forbids reopen or rewrite after approved', () => {
    assert.equal(isSettlementLocked('approved'), true);
    assert.equal(isSettlementLocked('paid'), true);
    assert.equal(isSettlementLocked('draft'), false);
    assert.equal(canRewriteSettlementFacts('approved'), false);
    assert.equal(canRewriteSettlementFacts('paid'), false);
    assert.equal(canReopenSettlement('approved'), false);
    assert.equal(canReopenSettlement('paid'), false);
    assert.equal(canTransitionSettlement('approved', 'reviewing'), false);
    assert.equal(canTransitionSettlement('approved', 'draft'), false);
    assert.equal(correctionForLockedSettlement('approved'), 'next_period_adjustment');
    assert.equal(correctionModeForCompletedFact('settlement'), 'next_period_adjustment');
    assert.equal(correctionModeForCompletedFact('sale'), 'reversal');
    assert.throws(() => assertCompletedFactImmutable(), /不可修改或刪除原事實/);
  });

  it('blocks staff from changing commission or settlement', () => {
    assert.equal(canChangeCommissionRate('merchant_staff'), false);
    assert.equal(canChangeCommissionRate('merchant_owner'), false);
    assert.equal(canChangeCommissionRate('hq'), true);
    assert.equal(canMutateSettlement('merchant_staff', 'draft'), false);
    assert.equal(canMutateSettlement('hq', 'draft'), true);
    assert.equal(canMutateSettlement('hq', 'approved'), false);
    assert.equal(canProposeExtraAdjustment('merchant_staff'), false);
    assert.equal(canProposeExtraAdjustment('merchant_owner'), true);
    assert.equal(canApproveAdjustment('merchant_owner'), false);
    assert.equal(canApproveAdjustment('hq'), true);
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

  it('refuses to treat client financial fields as truth', () => {
    for (const field of [
      'merchantId',
      'price',
      'commission',
      'paymentStatus',
      'voucherAmount',
    ] as const) {
      assert.equal(isUntrustedClientField(field), true);
    }
    assert.deepEqual([...UNTRUSTED_CLIENT_FIELDS], [
      'merchantId',
      'price',
      'commission',
      'paymentStatus',
      'voucherAmount',
    ]);
    assert.deepEqual(requireServerResolved({ source: 'server', netSalesTwd: 100 }), {
      source: 'server',
      netSalesTwd: 100,
    });
  });
});

