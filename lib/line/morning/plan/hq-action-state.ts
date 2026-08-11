/** Plan preview UX state（非 server action；可供 client／test 匯入） */

export type MorningPlanPreviewUxState = {
  status: 'idle' | 'success' | 'error';
  plannedCount: number;
  skippedCount: number;
  errorCount: number;
  transactionalSuppressedCount: number;
  runDate: string | null;
  /** 成功才更新；失敗必須為 null（由 client 不覆蓋舊值） */
  completedAt: string | null;
  message: string;
};

export const INITIAL_MORNING_PLAN_PREVIEW_UX_STATE: MorningPlanPreviewUxState = {
  status: 'idle',
  plannedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  transactionalSuppressedCount: 0,
  runDate: null,
  completedAt: null,
  message: '',
};
