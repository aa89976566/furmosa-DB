import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import {
  classifyCompleteOrderConflict,
  classifyVerifyOrderConflict,
  expectedCompleteFromStatus,
  interpretClaimCount,
  isFirstDeliveryPath,
  isPointsLedgerUniqueConflict,
  mapCustomerPayments,
  toCustomerPaymentView,
} from '@/lib/refill/integrity-lock';
import { serializeOrder } from '@/lib/refill/service';
import { canTransition } from '@/lib/refill/transitions';

describe('integrity-lock: complete expected status', () => {
  it('exchange expects old_container_verified', () => {
    assert.equal(
      expectedCompleteFromStatus({ deliveryMode: 'exchange', orderType: 'exchange' }),
      'old_container_verified',
    );
    assert.equal(isFirstDeliveryPath({ deliveryMode: 'exchange', orderType: 'exchange' }), false);
    assert.equal(canTransition('old_container_verified', 'completed'), true);
  });

  it('first / topup-as-first expects paid_waiting_return (unchanged)', () => {
    assert.equal(
      expectedCompleteFromStatus({ deliveryMode: 'first', orderType: 'first' }),
      'paid_waiting_return',
    );
    assert.equal(
      expectedCompleteFromStatus({ deliveryMode: 'first', orderType: 'exchange' }),
      'paid_waiting_return',
    );
    assert.equal(isFirstDeliveryPath({ deliveryMode: 'first', orderType: 'exchange' }), true);
    assert.equal(canTransition('paid_waiting_return', 'completed'), true);
  });
});

describe('integrity-lock: updateMany claim interpretation', () => {
  it('count===1 wins the lock', () => {
    assert.equal(interpretClaimCount(1), 'won');
  });

  it('count===0 loses — caller must not mutate jars or award points', () => {
    assert.equal(interpretClaimCount(0), 'lost');
    assert.equal(interpretClaimCount(2), 'lost');
  });

  it('simulates complete: lost lock does not proceed to jar updates', () => {
    const steps: string[] = [];
    const orderClaimCount = 0;
    if (interpretClaimCount(orderClaimCount) === 'won') {
      steps.push('return_old');
      steps.push('issue_new');
      steps.push('award_points');
    } else {
      const kind = classifyCompleteOrderConflict('completed');
      steps.push(kind);
    }
    assert.deepEqual(steps, ['idempotent_completed']);
    assert.equal(steps.includes('issue_new'), false);
    assert.equal(steps.includes('award_points'), false);
  });

  it('simulates complete: won lock then jar failure aborts before points', () => {
    const steps: string[] = [];
    const orderClaimCount = 1;
    assert.equal(interpretClaimCount(orderClaimCount), 'won');
    steps.push('order_completed');

    const newJarClaimCount = 0;
    if (interpretClaimCount(newJarClaimCount) !== 'won') {
      steps.push('rollback_jar_conflict');
      // transaction would throw — no points
    } else {
      steps.push('award_points');
    }
    assert.deepEqual(steps, ['order_completed', 'rollback_jar_conflict']);
  });

  it('simulates old jar claim failure aborts', () => {
    const steps: string[] = [];
    assert.equal(interpretClaimCount(1), 'won'); // order
    steps.push('order_locked');
    if (interpretClaimCount(0) !== 'won') {
      steps.push('old_jar_conflict');
    } else {
      steps.push('issue_new');
    }
    assert.deepEqual(steps, ['order_locked', 'old_jar_conflict']);
  });

  it('non-completed lost lock is invalid_status conflict', () => {
    assert.equal(classifyCompleteOrderConflict('old_container_verified'), 'invalid_status');
    assert.equal(classifyCompleteOrderConflict('paid_waiting_return'), 'invalid_status');
  });
});

describe('integrity-lock: verify concurrency', () => {
  it('same serial after verify is idempotent', () => {
    assert.equal(
      classifyVerifyOrderConflict({
        status: 'old_container_verified',
        oldContainerSerial: '12345678',
        attemptedSerial: '12345678',
      }),
      'idempotent_same_serial',
    );
  });

  it('different serial must not overwrite', () => {
    assert.equal(
      classifyVerifyOrderConflict({
        status: 'old_container_verified',
        oldContainerSerial: '12345678',
        attemptedSerial: '87654321',
      }),
      'conflict_different_serial',
    );
  });

  it('illegal status cannot verify', () => {
    assert.equal(
      classifyVerifyOrderConflict({
        status: 'payment_pending',
        oldContainerSerial: null,
        attemptedSerial: '12345678',
      }),
      'invalid_status',
    );
    assert.equal(
      classifyVerifyOrderConflict({
        status: 'completed',
        oldContainerSerial: '12345678',
        attemptedSerial: '12345678',
      }),
      'invalid_status',
    );
  });
});

describe('integrity-lock: points unique conflict', () => {
  it('P2002 on source_type+source_ref_id is treated as already awarded', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.20.0',
      meta: { target: ['source_type', 'source_ref_id'] },
    });
    assert.equal(isPointsLedgerUniqueConflict(err), true);
  });

  it('P2002 on other fields is NOT swallowed', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.20.0',
      meta: { target: ['id'] },
    });
    assert.equal(isPointsLedgerUniqueConflict(err), false);
  });

  it('non-P2002 errors are not unique conflicts', () => {
    assert.equal(isPointsLedgerUniqueConflict(new Error('db down')), false);
    assert.equal(
      isPointsLedgerUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('fail', {
          code: 'P2003',
          clientVersion: '5.20.0',
        }),
      ),
      false,
    );
  });

  it('exchange awards +1; first path does not (timing unchanged)', () => {
    const exchangeShouldAward =
      !isFirstDeliveryPath({ deliveryMode: 'exchange', orderType: 'exchange' }) &&
      true;
    const firstShouldAward =
      !isFirstDeliveryPath({ deliveryMode: 'first', orderType: 'first' }) && true;
    assert.equal(exchangeShouldAward, true);
    assert.equal(firstShouldAward, false);
  });
});

describe('integrity-lock: customer payment serialization', () => {
  it('whitelist maps paidAt and drops unknown fields when mapping', () => {
    const raw = {
      id: 'pay_1',
      purpose: 'refill',
      amount: 99,
      status: 'paid',
      paidAt: new Date('2026-08-01T04:00:00.000Z'),
      merchantTradeNo: 'FT123',
      callbackPayload: { CheckMacValue: 'SECRET', RtnCode: '1' },
      providerTradeNo: 'internal',
    };
    const view = toCustomerPaymentView(raw);
    assert.equal(view.id, 'pay_1');
    assert.equal(view.purpose, 'refill');
    assert.equal(view.amount, 99);
    assert.equal(view.status, 'paid');
    assert.equal(view.paidAt, '2026-08-01T04:00:00.000Z');
    assert.equal(view.merchantTradeNo, 'FT123');
    assert.equal('callbackPayload' in view, false);
    assert.equal('providerTradeNo' in view, false);
    assert.equal('CheckMacValue' in view, false);
  });

  it('serializeOrder never returns callbackPayload even if passed in', () => {
    const startsAt = new Date('2026-08-02T02:00:00.000Z');
    const leakyPayment = {
      id: 'pay_1',
      purpose: 'refill',
      amount: 99,
      status: 'paid',
      paidAt: new Date('2026-08-01T04:00:00.000Z'),
      merchantTradeNo: 'FT999',
      callbackPayload: { CheckMacValue: 'LEAK', raw: true },
      providerTradeNo: 'SHOULD_NOT_APPEAR',
    };
    const result = serializeOrder({
      id: 'ro_1',
      status: 'paid_waiting_return',
      orderType: 'exchange',
      deliveryMode: 'exchange',
      baseAmount: 99,
      extraAmount: 0,
      totalAmount: 99,
      petName: 'Lucky',
      oldContainerSerial: null,
      newContainerSerial: null,
      missingContainerNote: null,
      paidAt: new Date('2026-08-01T04:00:00.000Z'),
      completedAt: null,
      merchant: { id: 'm1', name: '店A', merchantId: 'mer_001' },
      appointment: {
        id: 'a1',
        startsAt,
        petName: 'Lucky',
        status: 'confirmed',
        serviceName: '美容',
      },
      payments: [leakyPayment],
    });

    assert.equal(result.payments.length, 1);
    const p = result.payments[0]!;
    assert.deepEqual(Object.keys(p).sort(), [
      'amount',
      'id',
      'merchantTradeNo',
      'paidAt',
      'purpose',
      'status',
    ]);
    assert.equal('callbackPayload' in p, false);
    assert.equal(JSON.stringify(result).includes('CheckMacValue'), false);
    assert.equal(JSON.stringify(result).includes('callbackPayload'), false);
    assert.equal(JSON.stringify(result).includes('SHOULD_NOT_APPEAR'), false);
  });

  it('mapCustomerPayments handles empty', () => {
    assert.deepEqual(mapCustomerPayments(undefined), []);
    assert.deepEqual(mapCustomerPayments(null), []);
  });
});
