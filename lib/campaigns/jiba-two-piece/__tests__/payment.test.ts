import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APP_STATUS, FLOW_STATE, JIBA_SHIPPING_FEE, PAYMENT_STATUS } from '../constants';
import {
  assessJibaShippingFee,
  buildPaymentDeclarationPatch,
  canMarkJibaShipmentShipped,
  decideJibaApproveTransition,
  describeJibaShippingCharge,
  isJibaBackfillCandidate,
  isJibaPaymentDeclared,
  isJibaPaymentReviewHold,
  isJibaPaymentSatisfied,
  isShipmentQueueVisibleOrderStatus,
  jibaBackfillRepairKind,
  shouldRedirectToTransfer,
} from '../payment';

describe('jiba shipping fee assessment', () => {
  it('charges 60 by default after skip or interest-only upsell', () => {
    assert.deepEqual(assessJibaShippingFee({ upsellAsked: true, upsellInterest: false }), {
      due: true,
      amount: JIBA_SHIPPING_FEE,
      reason: 'due',
    });
    assert.deepEqual(assessJibaShippingFee({ upsellAsked: true, upsellInterest: true }), {
      due: true,
      amount: JIBA_SHIPPING_FEE,
      reason: 'due',
    });
  });

  it('waives fee when upsell amount reaches 7-11 threshold', () => {
    const fee = assessJibaShippingFee({
      upsellAsked: true,
      upsellAmount: 399,
      shippingMethod: 'convenience',
    });
    assert.equal(fee.due, false);
    assert.equal(fee.reason, 'free_cvs');
  });

  it('waives fee when black-cat threshold is met', () => {
    const fee = assessJibaShippingFee({
      upsellAmount: 886,
      shippingMethod: 'blackCat',
    });
    assert.equal(fee.due, false);
    assert.equal(fee.reason, 'free_blackcat');
  });
});

describe('jiba payment declaration', () => {
  it('does not treat unpaid as declared', () => {
    assert.equal(isJibaPaymentDeclared(PAYMENT_STATUS.UNPAID, {}), false);
    assert.equal(isJibaPaymentSatisfied({ paymentStatus: 'unpaid', collected: {} }), false);
  });

  it('accepts declared status or collected timestamp', () => {
    assert.equal(isJibaPaymentDeclared(PAYMENT_STATUS.DECLARED, {}), true);
    assert.equal(
      isJibaPaymentDeclared('unpaid', { declaredPaidAt: '2026-08-17T01:00:00.000Z' }),
      true,
    );
    const patch = buildPaymentDeclarationPatch({
      accountLast5: '99991',
      declaredAt: new Date('2026-08-17T01:00:00.000Z'),
    });
    assert.equal(patch.paymentMethod, 'bank_transfer');
    assert.equal(patch.declaredAmount, 60);
    assert.equal(patch.transferAccountLast5, '99991');
    assert.doesNotMatch(JSON.stringify(patch), /00000999991/);
  });
});

describe('jiba approve transition', () => {
  it('PENDING_REVIEW + declared → READY_TO_SHIP and create shipment', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.PENDING_REVIEW,
      paymentStatus: PAYMENT_STATUS.DECLARED,
      collected: { declaredPaidAt: '2026-08-17T01:00:00.000Z' },
    });
    assert.equal(decision.action, 'queue');
    if (decision.action === 'queue') {
      assert.equal(decision.nextAppStatus, APP_STATUS.READY_TO_SHIP);
      assert.equal(decision.nextOrderStatus, 'confirmed');
      assert.equal(decision.createShipment, true);
    }
  });

  it('PENDING_REVIEW + unpaid fee due → AWAITING, still create shipment', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.PENDING_REVIEW,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      collected: { upsellAsked: true },
    });
    assert.equal(decision.action, 'await_payment');
    if (decision.action === 'await_payment') {
      assert.equal(decision.nextAppStatus, APP_STATUS.AWAITING_SHIPPING_PAYMENT);
      assert.equal(decision.nextOrderStatus, 'awaiting_shipping_payment');
      assert.equal(decision.shippingQueueStatus, 'QUEUED');
      assert.equal(decision.createShipment, true);
    }
  });

  it('PENDING_REVIEW + free shipping → READY_TO_SHIP', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.PENDING_REVIEW,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      collected: { upsellAmount: 399 },
    });
    assert.equal(decision.action, 'queue');
    if (decision.action === 'queue') {
      assert.equal(decision.createShipment, true);
    }
  });

  it('repeat approve on READY_TO_SHIP is idempotent and still ensures shipment', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.READY_TO_SHIP,
      paymentStatus: PAYMENT_STATUS.DECLARED,
    });
    assert.equal(decision.action, 'idempotent');
    if (decision.action === 'idempotent') {
      assert.equal(decision.nextAppStatus, APP_STATUS.READY_TO_SHIP);
      assert.equal(decision.createShipment, true);
    }
  });

  it('repeat approve while awaiting unpaid still ensures shipment', () => {
    const decision = decideJibaApproveTransition({
      status: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
      paymentStatus: PAYMENT_STATUS.UNPAID,
    });
    assert.equal(decision.action, 'idempotent');
    if (decision.action === 'idempotent') {
      assert.equal(decision.nextAppStatus, APP_STATUS.AWAITING_SHIPPING_PAYMENT);
      assert.equal(decision.createShipment, true);
    }
  });
});

describe('shipment list visibility', () => {
  it('lists confirmed / awaiting / pending_review orders, hides cancelled', () => {
    assert.equal(isShipmentQueueVisibleOrderStatus('confirmed'), true);
    assert.equal(isShipmentQueueVisibleOrderStatus('awaiting_shipping_payment'), true);
    assert.equal(isShipmentQueueVisibleOrderStatus('pending_review'), true);
    assert.equal(isShipmentQueueVisibleOrderStatus('draft'), true);
    assert.equal(isShipmentQueueVisibleOrderStatus('cancelled'), false);
  });

  it('holds awaiting payment review so staff cannot mark shipped', () => {
    assert.equal(
      isJibaPaymentReviewHold({ status: 'awaiting_shipping_payment', paymentStatus: 'unpaid' }),
      true,
    );
    assert.equal(canMarkJibaShipmentShipped({ status: 'awaiting_shipping_payment' }), false);
    assert.equal(canMarkJibaShipmentShipped({ status: 'confirmed', paymentStatus: 'unpaid' }), true);
    assert.equal(isJibaPaymentReviewHold({ status: 'confirmed' }), false);
    assert.equal(isJibaPaymentReviewHold(null), false);
  });

  it('holds declared-but-unpaid jiba orders even after confirm', () => {
    assert.equal(
      isJibaPaymentReviewHold({
        status: 'confirmed',
        paymentStatus: PAYMENT_STATUS.DECLARED,
        collected: { declaredPaidAt: '2026-08-17T01:00:00.000Z' },
        isJiba: true,
      }),
      true,
    );
    assert.equal(
      canMarkJibaShipmentShipped({
        status: 'confirmed',
        paymentStatus: PAYMENT_STATUS.DECLARED,
        isJiba: true,
      }),
      false,
    );
    assert.equal(
      canMarkJibaShipmentShipped({
        status: 'confirmed',
        paymentStatus: PAYMENT_STATUS.PAID,
        isJiba: true,
      }),
      true,
    );
    assert.equal(
      canMarkJibaShipmentShipped({
        status: 'confirmed',
        paymentStatus: 'unpaid',
        collected: { upsellAmount: 399 },
        isJiba: true,
      }),
      true,
    );
  });
});

describe('jiba shipping charge display', () => {
  it('labels fee due, declared, paid, threshold free, and waived', () => {
    assert.deepEqual(describeJibaShippingCharge({ paymentStatus: 'unpaid', collected: {} }), {
      kind: 'awaiting_declaration',
      label: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜待申報`,
      hold: true,
    });
    assert.deepEqual(
      describeJibaShippingCharge({
        paymentStatus: PAYMENT_STATUS.DECLARED,
        collected: { declaredPaidAt: '2026-08-17T01:00:00.000Z' },
      }),
      {
        kind: 'declared',
        label: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜已申報待核帳`,
        hold: true,
      },
    );
    assert.deepEqual(describeJibaShippingCharge({ paymentStatus: PAYMENT_STATUS.PAID }), {
      kind: 'paid',
      label: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜已核帳`,
      hold: false,
    });
    assert.deepEqual(describeJibaShippingCharge({ collected: { upsellAmount: 399 } }), {
      kind: 'free_threshold',
      label: '加購達門檻｜免運',
      hold: false,
    });
    assert.deepEqual(describeJibaShippingCharge({ collected: { shippingFeeWaived: true } }), {
      kind: 'free_waived',
      label: '免運',
      hold: false,
    });
    assert.deepEqual(describeJibaShippingCharge({ paymentStatus: PAYMENT_STATUS.WAIVED }), {
      kind: 'free_waived',
      label: '免運',
      hold: false,
    });
    assert.doesNotMatch(
      describeJibaShippingCharge({ paymentStatus: 'unpaid', collected: {} }).label,
      /包郵/,
    );
  });
});

describe('old session transfer redirect', () => {
  it('only redirects collecting sessions that already answered upsell', () => {
    assert.equal(
      shouldRedirectToTransfer({
        state: FLOW_STATE.ASK_INSTAGRAM,
        collected: { upsellAsked: true },
        paymentStatus: 'unpaid',
      }),
      true,
    );
    assert.equal(
      shouldRedirectToTransfer({
        state: FLOW_STATE.PENDING_REVIEW,
        collected: { upsellAsked: true },
        paymentStatus: 'unpaid',
      }),
      false,
    );
  });
});

describe('backfill candidate', () => {
  it('selects approved without shipment even if unpaid; skips cancelled or already queued', () => {
    assert.equal(
      isJibaBackfillCandidate({
        appStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.DECLARED,
        collected: { declaredPaidAt: '2026-08-17T01:00:00.000Z' },
        hasActiveShipment: false,
        orderId: 'ord_declared',
      }),
      true,
    );
    assert.equal(
      isJibaBackfillCandidate({
        appStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        collected: {},
        hasActiveShipment: false,
        orderId: 'ord_unpaid',
      }),
      true,
    );
    assert.equal(
      isJibaBackfillCandidate({
        appStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        hasActiveShipment: false,
        orderId: null,
      }),
      false,
    );
    assert.equal(
      isJibaBackfillCandidate({
        appStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        hasActiveShipment: false,
        orderId: 'ord_cancelled',
        orderStatus: 'cancelled',
      }),
      false,
    );
    assert.equal(
      isJibaBackfillCandidate({
        appStatus: APP_STATUS.READY_TO_SHIP,
        paymentStatus: PAYMENT_STATUS.DECLARED,
        hasActiveShipment: true,
        orderId: 'ord_queued',
      }),
      false,
    );
    assert.equal(
      jibaBackfillRepairKind({
        appStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.UNPAID,
      }),
      'await_payment_shipment',
    );
    assert.equal(
      jibaBackfillRepairKind({
        appStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.DECLARED,
        collected: { declaredPaidAt: '2026-08-17T01:00:00.000Z' },
      }),
      'queue_ready',
    );
  });
});
