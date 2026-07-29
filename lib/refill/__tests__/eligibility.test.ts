import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBookableForRefill,
  resolveOrderTypeAndAmount,
  coerceServerAmount,
  findBlockingActiveOrder,
} from '@/lib/refill/eligibility';
import { REFILL_PRICES } from '@/lib/refill/constants';

const future = new Date('2026-08-01T06:00:00.000Z');
const past = new Date('2026-07-01T06:00:00.000Z');
const now = new Date('2026-07-27T00:00:00.000Z');

describe('refill eligibility', () => {
  it('1. has issued jar → exchange NT$99', () => {
    const r = resolveOrderTypeAndAmount({
      booking: { status: 'confirmed', startsAt: future, merchantId: 'm1', now },
      hasIssuedJar: true,
      activeOrdersForAppointment: [],
      clientAmount: 1,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.orderType, 'exchange');
      assert.equal(r.amount, 99);
    }
  });

  it('2. no issued jar → first NT$129 (not blocked)', () => {
    const r = resolveOrderTypeAndAmount({
      booking: { status: 'confirmed', startsAt: future, merchantId: 'm1', now },
      hasIssuedJar: false,
      activeOrdersForAppointment: [],
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.orderType, 'first');
      assert.equal(r.amount, REFILL_PRICES.first);
    }
  });

  it('3. unconfirmed booking cannot pay', () => {
    const b = isBookableForRefill({
      status: 'requested',
      startsAt: future,
      merchantId: 'm1',
      now,
    });
    assert.equal(b.ok, false);
    assert.equal(b.code, 'BOOKING_NOT_CONFIRMED');
  });

  it('4. cancelled booking cannot pay', () => {
    const b = isBookableForRefill({
      status: 'cancelled',
      startsAt: future,
      merchantId: 'm1',
      now,
    });
    assert.equal(b.ok, false);
    assert.equal(b.code, 'BOOKING_CANCELLED');
  });

  it('6. client wrong amount still coerced to server 99', () => {
    assert.equal(coerceServerAmount('exchange', 1), 99);
    assert.equal(coerceServerAmount('first', 9999), 129);
  });

  it('9. same appointment cannot have two active refill orders', () => {
    const blocking = findBlockingActiveOrder('a1', [
      { id: 'o1', status: 'paid_waiting_return', appointmentId: 'a1' },
    ]);
    assert.ok(blocking);
    const r = resolveOrderTypeAndAmount({
      booking: { status: 'confirmed', startsAt: future, merchantId: 'm1', now },
      hasIssuedJar: true,
      activeOrdersForAppointment: [
        { id: 'o1', status: 'payment_pending', appointmentId: 'a1' },
      ],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'ACTIVE_ORDER_EXISTS');
  });

  it('rejects past appointments', () => {
    const b = isBookableForRefill({
      status: 'confirmed',
      startsAt: past,
      merchantId: 'm1',
      now,
    });
    assert.equal(b.ok, false);
    assert.equal(b.code, 'BOOKING_EXPIRED');
  });
});
