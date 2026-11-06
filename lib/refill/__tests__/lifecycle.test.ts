import assert from 'node:assert/strict';
import test from 'node:test';
import { canCustomerCancelRefillOrder } from '../service';

test('customer can cancel an unpaid draft and release its reservation', () => {
  assert.equal(
    canCustomerCancelRefillOrder({ status: 'draft', blockingPaymentCount: 0 }),
    true,
  );
});

test('customer can cancel a failed order only when no blocking payment remains', () => {
  assert.equal(
    canCustomerCancelRefillOrder({
      status: 'payment_failed',
      blockingPaymentCount: 0,
    }),
    true,
  );
  assert.equal(
    canCustomerCancelRefillOrder({
      status: 'payment_failed',
      blockingPaymentCount: 1,
    }),
    false,
  );
});

test('customer cannot cancel after checkout was opened or payment completed', () => {
  for (const status of [
    'payment_pending',
    'paid_waiting_return',
    'old_container_verified',
    'completed',
  ]) {
    assert.equal(
      canCustomerCancelRefillOrder({ status, blockingPaymentCount: 0 }),
      false,
      status,
    );
  }
  assert.equal(
    canCustomerCancelRefillOrder({ status: 'draft', blockingPaymentCount: 1 }),
    false,
  );
});
