import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTaipeiRefillSummaryRange,
  maskJarCode,
} from '@/lib/refill/merchant-dashboard';
import { isGroomingCouponReward } from '@/lib/jar-exchange/redeem-reward';

describe('merchant refill dashboard', () => {
  it('POS 只顯示序號末四碼', () => {
    assert.equal(maskJarCode('12345678'), '•••• 5678');
  });

  it('跨月時以台北日曆月計算，並保留近 30 日真實交易區間', () => {
    const now = new Date('2026-11-01T08:25:00.000Z');
    const range = buildTaipeiRefillSummaryRange(now);

    assert.equal(range.todayStartedAt.toISOString(), '2026-10-31T16:00:00.000Z');
    assert.equal(range.monthStartedAt.toISOString(), '2026-10-31T16:00:00.000Z');
    assert.equal(range.last30DaysStartedAt.toISOString(), '2026-10-02T08:25:00.000Z');
    assert.equal(range.todayLabel, '11/01');
    assert.equal(range.monthLabel, '11月');
  });

  it('10 點美容券使用正式店家綁定券流程', () => {
    assert.equal(
      isGroomingCouponReward({ rewardType: 'grooming_coupon', pointsRequired: 10 }),
      true,
    );
    assert.equal(
      isGroomingCouponReward({ rewardType: 'grooming_coupon', pointsRequired: 5 }),
      false,
    );
  });
});
