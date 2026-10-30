import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maskJarCode } from '@/lib/refill/merchant-dashboard';

describe('merchant refill dashboard', () => {
  it('POS 只顯示序號末四碼', () => {
    assert.equal(maskJarCode('12345678'), '•••• 5678');
  });
});
