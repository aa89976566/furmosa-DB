import assert from 'node:assert/strict';
import test from 'node:test';

import { refillJarOwnershipWhere } from '@/lib/refill/service';

test('LINE-registered used serial grants refill ownership eligibility', () => {
  assert.deepEqual(refillJarOwnershipWhere('customer_1'), {
    redeemedByCustomerId: 'customer_1',
    status: { in: ['used', 'issued'] },
  });
});

test('ownership eligibility does not depend on an order lock', () => {
  const where = refillJarOwnershipWhere('customer_1') as Record<string, unknown>;
  assert.equal('lockedByRefillOrderId' in where, false);
});
