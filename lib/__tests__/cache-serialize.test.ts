import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Decimal } from '@prisma/client/runtime/library';
import { toCacheJSON } from '@/lib/cache-serialize';

describe('toCacheJSON', () => {
  it('converts Prisma Decimal and Date to plain JSON values', () => {
    const input = {
      price: new Decimal('199.5'),
      when: new Date('2026-07-25T00:00:00.000Z'),
      nested: { cost: new Decimal(10) },
      qty: 3n,
    };
    const out = toCacheJSON(input);
    assert.equal(out.price, 199.5);
    assert.equal(out.when, '2026-07-25T00:00:00.000Z');
    assert.equal(out.nested.cost, 10);
    assert.equal(out.qty, 3);
    assert.equal(JSON.parse(JSON.stringify(out)).price, 199.5);
  });
});
