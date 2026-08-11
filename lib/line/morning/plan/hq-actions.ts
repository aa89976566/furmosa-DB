'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { runDailyMorningPlan } from '@/lib/line/morning/plan/daily-runner';
import { MORNING_PLAN_REASONS } from '@/lib/line/morning/plan/types';
import type { MorningPlanPreviewUxState } from '@/lib/line/morning/plan/hq-action-state';

export type { MorningPlanPreviewUxState } from '@/lib/line/morning/plan/hq-action-state';
export { INITIAL_MORNING_PLAN_PREVIEW_UX_STATE } from '@/lib/line/morning/plan/hq-action-state';

const ALLOWED_ROLES = new Set(['admin', 'staff']);

async function requireHqMorningAdmin() {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ROLES.has(user.role)) {
    throw new Error('無權限');
  }
  return user;
}

/** HQ only：產生今日 plan ledger（結構零發送；不真送 LINE） */
export async function generateMorningPlanPreviewAction() {
  await requireHqMorningAdmin();
  await runDailyMorningPlan({ limit: 100 });
  revalidatePath('/campaigns/line-morning');
}

/**
 * UX wrapper：業務同 generateMorningPlanPreviewAction（auth + runDailyMorningPlan + revalidate）
 * 額外回傳摘要供 pending／success=0／error 顯示；不改 idempotency／auth 角色。
 */
export async function generateMorningPlanPreviewUxAction(
  _prev: MorningPlanPreviewUxState,
  _formData: FormData,
): Promise<MorningPlanPreviewUxState> {
  void _prev;
  void _formData;
  try {
    await requireHqMorningAdmin();
    const summary = await runDailyMorningPlan({ limit: 100 });
    revalidatePath('/campaigns/line-morning');
    const transactionalSuppressedCount = summary.results.filter(
      (r) => r.decisionReason === MORNING_PLAN_REASONS.TRANSACTIONAL_PRIORITY,
    ).length;
    const total = summary.plannedCount + summary.skippedCount;
    const completedAt = new Date().toISOString();
    if (total === 0) {
      return {
        status: 'success',
        plannedCount: 0,
        skippedCount: 0,
        errorCount: summary.errors.length,
        transactionalSuppressedCount,
        runDate: summary.runDate,
        completedAt,
        message: '檢查完成，目前沒有符合條件的會員',
      };
    }
    return {
      status: 'success',
      plannedCount: summary.plannedCount,
      skippedCount: summary.skippedCount,
      errorCount: summary.errors.length,
      transactionalSuppressedCount,
      runDate: summary.runDate,
      completedAt,
      message: `檢查完成：預計產生 ${summary.plannedCount}，略過 ${summary.skippedCount}`,
    };
  } catch {
    return {
      status: 'error',
      plannedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      transactionalSuppressedCount: 0,
      runDate: null,
      completedAt: null,
      message: '檢查失敗，請稍後再試',
    };
  }
}
