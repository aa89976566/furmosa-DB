import assert from 'node:assert/strict';
import test from 'node:test';

import { RefillError } from '@/lib/refill/errors';
import { assertRefillPaymentSnapshot } from '@/lib/refill/payment';

test('accepts the server snapshot for a first jar', () => {
  assert.doesNotThrow(() =>
    assertRefillPaymentSnapshot({
      orderType: 'first',
      deliveryMode: 'first',
      baseAmount: 129,
      extraAmount: 0,
      totalAmount: 129,
      hasValidReservation: false,
    }),
  );
});

test('accepts NT$99 only with a valid reserved jar', () => {
  assert.doesNotThrow(() =>
    assertRefillPaymentSnapshot({
      orderType: 'exchange',
      deliveryMode: 'exchange',
      baseAmount: 99,
      extraAmount: 0,
      totalAmount: 99,
      hasValidReservation: true,
    }),
  );
});

test('blocks an exchange payment when the jar reservation is missing', () => {
  assert.throws(
    () =>
      assertRefillPaymentSnapshot({
        orderType: 'exchange',
        deliveryMode: 'exchange',
        baseAmount: 99,
        extraAmount: 0,
        totalAmount: 99,
        hasValidReservation: false,
      }),
    (error) =>
      error instanceof RefillError &&
      error.code === 'REFILL_JAR_RESERVATION_MISSING' &&
      error.status === 409,
  );
});

test('blocks payment when an order price snapshot is stale', () => {
  assert.throws(
    () =>
      assertRefillPaymentSnapshot({
        orderType: 'exchange',
        deliveryMode: 'exchange',
        baseAmount: 129,
        extraAmount: 0,
        totalAmount: 129,
        hasValidReservation: true,
      }),
    (error) =>
      error instanceof RefillError &&
      error.code === 'REFILL_PRICE_CHANGED' &&
      error.status === 409,
  );
});

test('blocks payment when the order type is unknown', () => {
  assert.throws(
    () =>
      assertRefillPaymentSnapshot({
        orderType: 'legacy',
        deliveryMode: 'first',
        baseAmount: 129,
        extraAmount: 0,
        totalAmount: 129,
        hasValidReservation: false,
      }),
    (error) =>
      error instanceof RefillError &&
      error.code === 'REFILL_PRICE_CHANGED' &&
      error.status === 409,
  );
});
