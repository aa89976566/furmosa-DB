import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canRefreshRefillQualification,
  refillJarOwnershipWhere,
  refillJarReservationWhere,
} from '@/lib/refill/service';

test('LINE-registered used serial grants refill ownership eligibility', () => {
  assert.deepEqual(refillJarOwnershipWhere('customer_1'), {
    redeemedByCustomerId: 'customer_1',
    status: { in: ['used', 'issued'] },
  });
});

test('reprices only unpaid drafts or failed payments without an active checkout', () => {
  assert.equal(
    canRefreshRefillQualification({ status: 'draft', blockingPaymentCount: 0 }),
    true,
  );
  assert.equal(
    canRefreshRefillQualification({ status: 'payment_failed', blockingPaymentCount: 0 }),
    true,
  );
  assert.equal(
    canRefreshRefillQualification({ status: 'draft', blockingPaymentCount: 1 }),
    false,
  );
  assert.equal(
    canRefreshRefillQualification({ status: 'payment_pending', blockingPaymentCount: 0 }),
    false,
  );
});

test('ownership eligibility does not depend on an order lock', () => {
  const where = refillJarOwnershipWhere('customer_1') as Record<string, unknown>;
  assert.equal('lockedByRefillOrderId' in where, false);
});

test('a new exchange order can reserve only an unlocked LINE jar', () => {
  assert.deepEqual(refillJarReservationWhere('customer_1'), {
    redeemedByCustomerId: 'customer_1',
    status: { in: ['used', 'issued'] },
    lockedByRefillOrderId: null,
  });
});
