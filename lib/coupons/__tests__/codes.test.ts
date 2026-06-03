import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateFurmosaCouponCode,
  isValidFurmosaCouponFormat,
  normalizeCouponCode,
} from '@/lib/coupons/codes';

describe('furmosa coupon codes', () => {
  it('normalizes to uppercase without spaces', () => {
    assert.equal(normalizeCouponCode(' furmosa-1234 '), 'FURMOSA-1234');
  });

  it('validates four-digit suffix', () => {
    assert.equal(isValidFurmosaCouponFormat('FURMOSA-1234'), true);
    assert.equal(isValidFurmosaCouponFormat('FURMOSA-0000'), true);
    assert.equal(isValidFurmosaCouponFormat('FURMOSA-A8F3'), false);
    assert.equal(isValidFurmosaCouponFormat('FURMOSA-12345'), false);
  });

  it('generates FURMOSA- plus four digits', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateFurmosaCouponCode();
      assert.match(code, /^FURMOSA-\d{4}$/);
    }
  });
});
