import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCustomerBookingIdentity,
  CUSTOMER_BOOKING_LOGIN_REQUIRED_MESSAGE,
  isCustomerBookingIdentityPresent,
} from '@/lib/booking/auth-gate';
import { isAnonymousBookingAllowed } from '@/lib/rls/policy-matrix';

describe('customer booking auth gate', () => {
  it('rejects missing LINE identity (anonymous booking)', () => {
    assert.equal(isAnonymousBookingAllowed(), false);
    assert.equal(isCustomerBookingIdentityPresent(null), false);
    assert.equal(isCustomerBookingIdentityPresent(''), false);
    assert.equal(isCustomerBookingIdentityPresent('   '), false);
    assert.throws(
      () => assertCustomerBookingIdentity(undefined),
      (err: unknown) =>
        err instanceof Error && err.message === CUSTOMER_BOOKING_LOGIN_REQUIRED_MESSAGE,
    );
  });

  it('accepts verified LINE user id', () => {
    assert.equal(isCustomerBookingIdentityPresent('Uabc123'), true);
    assert.equal(assertCustomerBookingIdentity('  Uabc123  '), 'Uabc123');
  });
});
