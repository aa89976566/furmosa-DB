import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRefillFulfillmentInput } from '@/lib/refill/fulfillment-input';

describe('refill fulfillment input', () => {
  it('正規化空罐序號', () => {
    const result = parseRefillFulfillmentInput({
      pickupQuantity: 1,
      returnedSerials: ['1234-5678'],
      idempotencyKey: 'pos-test-0001',
    });
    assert.deepEqual(result.returnedSerials, ['12345678']);
  });

  it('拒絕同一次提交重複序號', () => {
    assert.throws(() => parseRefillFulfillmentInput({
      pickupQuantity: 1,
      returnedSerials: ['12345678', '12345678'],
      idempotencyKey: 'pos-test-0002',
    }));
  });

  it('拒絕錯誤序號格式', () => {
    assert.throws(() => parseRefillFulfillmentInput({
      pickupQuantity: 1,
      returnedSerials: ['1234'],
      idempotencyKey: 'pos-test-0003',
    }));
  });
});
