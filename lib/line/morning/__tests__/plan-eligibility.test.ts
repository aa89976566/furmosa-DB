import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateMorningPlanEligibility,
  MORNING_PLAN_REASONS,
} from '@/lib/line/morning/plan';
import type { MorningPreferenceRow } from '@/lib/line/morning/preferences';

function pref(
  partial: Partial<MorningPreferenceRow>,
): MorningPreferenceRow {
  return {
    id: 'p',
    lineUserId: 'U1',
    customerId: null,
    contentMode: 'jokes',
    frequency: 'daily',
    pausedAt: null,
    promptedAt: null,
    ...partial,
  };
}

/** 2026-08-07 = Friday Taipei */
const FRI = new Date('2026-08-07T12:00:00+08:00');
/** 2026-08-08 = Saturday */
const SAT = new Date('2026-08-08T12:00:00+08:00');

describe('Phase 4B-C plan eligibility', () => {
  it('null／unset／off／未確認 → typed skip；不預設 DAILY', () => {
    assert.equal(
      evaluateMorningPlanEligibility({
        preference: null,
        hasConfirmSuccess: false,
        runInstant: FRI,
      }).eligible,
      false,
    );
    const unset = evaluateMorningPlanEligibility({
      preference: pref({ contentMode: 'unset', frequency: 'unset' }),
      hasConfirmSuccess: false,
      runInstant: FRI,
    });
    assert.equal(unset.eligible, false);
    if (!unset.eligible) {
      assert.equal(unset.reason, MORNING_PLAN_REASONS.NOT_CONFIRMED);
    }

    const off = evaluateMorningPlanEligibility({
      preference: pref({ contentMode: 'off', frequency: 'off' }),
      hasConfirmSuccess: true,
      runInstant: FRI,
    });
    assert.equal(off.eligible, false);
    if (!off.eligible) assert.equal(off.reason, MORNING_PLAN_REASONS.OPTED_OUT);
  });

  it('daily／weekday／weekly（週五）單一 eligible boolean', () => {
    const dailyOk = evaluateMorningPlanEligibility({
      preference: pref({ frequency: 'daily' }),
      hasConfirmSuccess: true,
      runInstant: SAT,
    });
    assert.equal(dailyOk.eligible, true);

    const weekdaySat = evaluateMorningPlanEligibility({
      preference: pref({ frequency: 'weekday' }),
      hasConfirmSuccess: true,
      runInstant: SAT,
    });
    assert.equal(weekdaySat.eligible, false);
    if (!weekdaySat.eligible) {
      assert.equal(weekdaySat.reason, MORNING_PLAN_REASONS.FREQUENCY_MISMATCH);
    }

    const weeklyFri = evaluateMorningPlanEligibility({
      preference: pref({ frequency: 'weekly' }),
      hasConfirmSuccess: true,
      runInstant: FRI,
    });
    assert.equal(weeklyFri.eligible, true);

    const weeklySat = evaluateMorningPlanEligibility({
      preference: pref({ frequency: 'weekly' }),
      hasConfirmSuccess: true,
      runInstant: SAT,
    });
    assert.equal(weeklySat.eligible, false);
  });

  it('legacy complete 可視為已確認；缺 confirm 且不完整 → not_confirmed', () => {
    const legacy = evaluateMorningPlanEligibility({
      preference: pref({ contentMode: 'alternate', frequency: 'daily' }),
      hasConfirmSuccess: false,
      runInstant: FRI,
    });
    assert.equal(legacy.eligible, true);
  });
});
