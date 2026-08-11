import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildTodayPlanSummaryView,
} from '@/lib/line/morning/hq/plan-summary-view';
import { MORNING_PLAN_REASONS } from '@/lib/line/morning/plan/types';
import {
  INITIAL_MORNING_PLAN_PREVIEW_UX_STATE,
} from '@/lib/line/morning/plan/hq-action-state';
import { tallyPreferenceFrequencies } from '@/lib/line/morning/hq/preference-stats';

describe('4B-D plan UX view-model', () => {
  it('success=0 empty state 可辨', () => {
    const view = buildTodayPlanSummaryView({
      runDate: '2026-08-11',
      plannedCount: 0,
      skippedCount: 0,
      rows: [],
      transactionalCoverageNotes: [],
      notes: [],
    });
    assert.equal(view.empty, true);
    assert.equal(view.plannedCount, 0);
    assert.equal(view.skippedCount, 0);
  });

  it('transactional 讓路數由 typed reason 計算', () => {
    const view = buildTodayPlanSummaryView({
      runDate: '2026-08-11',
      plannedCount: 1,
      skippedCount: 2,
      rows: [
        {
          maskedLineUserId: 'U…abcd',
          planStatus: 'PLANNED',
          decisionReason: MORNING_PLAN_REASONS.PLANNED,
          contentType: 'HUMOR',
          contentPreview: 'hi',
        },
        {
          maskedLineUserId: 'U…efgh',
          planStatus: 'SKIPPED',
          decisionReason: MORNING_PLAN_REASONS.TRANSACTIONAL_PRIORITY,
          contentType: null,
          contentPreview: null,
        },
        {
          maskedLineUserId: 'U…ijkl',
          planStatus: 'SKIPPED',
          decisionReason: MORNING_PLAN_REASONS.TRANSACTIONAL_PRIORITY,
          contentType: null,
          contentPreview: null,
        },
      ],
      transactionalCoverageNotes: [],
      notes: [],
    });
    assert.equal(view.transactionalSuppressedCount, 2);
    assert.equal(view.empty, false);
  });

  it('UX initial state：error 路徑 completedAt 必須可為 null', () => {
    assert.equal(INITIAL_MORNING_PLAN_PREVIEW_UX_STATE.completedAt, null);
    assert.equal(INITIAL_MORNING_PLAN_PREVIEW_UX_STATE.status, 'idle');
  });

  it('plan form 文案含 pending／success0／error／不會發送', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/(main)/campaigns/line-morning/dashboard/plan-generate-form.tsx'),
      'utf8',
    );
    assert.match(src, /正在檢查/);
    assert.match(src, /不會發送/);
    assert.match(src, /aria-live/);
    assert.match(src, /檢查失敗，請稍後再試/);
    const ux = readFileSync(
      resolve(process.cwd(), 'lib/line/morning/plan/hq-actions.ts'),
      'utf8',
    );
    assert.match(ux, /目前沒有符合條件的會員/);
    assert.match(ux, /completedAt: null/);
  });

  it('preference 統計：每天／平日／週五／關閉／未設定', () => {
    const stats = tallyPreferenceFrequencies([
      { frequency: 'daily' },
      { frequency: 'daily' },
      { frequency: 'weekday' },
      { frequency: 'weekly' },
      { frequency: 'off' },
      { frequency: 'unset' },
      { frequency: 'weird' },
    ]);
    assert.equal(stats.daily, 2);
    assert.equal(stats.weekday, 1);
    assert.equal(stats.weekly, 1);
    assert.equal(stats.off, 1);
    assert.equal(stats.unset, 1);
    assert.equal(stats.other, 1);
    assert.equal(stats.total, 7);
  });
});
