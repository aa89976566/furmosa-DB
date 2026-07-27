import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition } from '@/lib/refill/transitions';
import {
  REFILL_PRICES,
  amountsForOrderType,
  amountsAfterExtraTopup,
} from '@/lib/refill/constants';

describe('refill transitions', () => {
  it('allows payment_pending → paid_waiting_return', () => {
    assert.equal(canTransition('payment_pending', 'paid_waiting_return'), true);
  });

  it('allows paid_waiting_return → old_container_verified → completed', () => {
    assert.equal(canTransition('paid_waiting_return', 'old_container_verified'), true);
    assert.equal(canTransition('old_container_verified', 'completed'), true);
  });

  it('allows paid_waiting_return → awaiting_extra_payment → paid_waiting_return', () => {
    assert.equal(canTransition('paid_waiting_return', 'awaiting_extra_payment'), true);
    assert.equal(canTransition('awaiting_extra_payment', 'paid_waiting_return'), true);
  });

  it('allows first-path complete without old jar verify', () => {
    assert.equal(canTransition('paid_waiting_return', 'completed'), true);
  });

  it('rejects completed → anything', () => {
    assert.equal(canTransition('completed', 'paid_waiting_return'), false);
    assert.throws(() => assertTransition('completed', 'cancelled'));
  });

  it('rejects skipping payment', () => {
    assert.equal(canTransition('draft', 'paid_waiting_return'), false);
    assert.equal(canTransition('draft', 'completed'), false);
  });
});

describe('refill prices', () => {
  it('exchange is NT$99 fixed', () => {
    const a = amountsForOrderType('exchange');
    assert.equal(a.totalAmount, REFILL_PRICES.exchange);
    assert.equal(a.totalAmount, 99);
  });

  it('first is NT$129 fixed', () => {
    const a = amountsForOrderType('first');
    assert.equal(a.totalAmount, 129);
  });

  it('extra topup makes total 129', () => {
    const a = amountsAfterExtraTopup();
    assert.equal(a.extraAmount, 30);
    assert.equal(a.totalAmount, 129);
  });
});
