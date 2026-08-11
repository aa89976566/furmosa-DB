/**
 * 今日早安 view-model（presentation only）
 * 從既有 plan preview／ledger 列計算摘要，不改 runner。
 */

import { MORNING_PLAN_REASONS } from '@/lib/line/morning/plan/types';
import type { MorningPlanPreviewResult } from '@/lib/line/morning/plan-preview';

export type MorningTodayPlanSummaryView = {
  runDate: string;
  plannedCount: number;
  skippedCount: number;
  anomalyCount: number;
  transactionalSuppressedCount: number;
  lastCheckedAt: string | null;
  empty: boolean;
};

export function buildTodayPlanSummaryView(
  preview: MorningPlanPreviewResult | null,
  opts?: {
    anomalyCount?: number;
    lastCheckedAt?: string | null;
  },
): MorningTodayPlanSummaryView {
  if (!preview) {
    return {
      runDate: '',
      plannedCount: 0,
      skippedCount: 0,
      anomalyCount: opts?.anomalyCount ?? 0,
      transactionalSuppressedCount: 0,
      lastCheckedAt: opts?.lastCheckedAt ?? null,
      empty: true,
    };
  }
  const transactionalSuppressedCount = preview.rows.filter(
    (r) => r.decisionReason === MORNING_PLAN_REASONS.TRANSACTIONAL_PRIORITY,
  ).length;
  return {
    runDate: preview.runDate,
    plannedCount: preview.plannedCount,
    skippedCount: preview.skippedCount,
    anomalyCount: opts?.anomalyCount ?? 0,
    transactionalSuppressedCount,
    lastCheckedAt: opts?.lastCheckedAt ?? null,
    empty: preview.rows.length === 0,
  };
}
