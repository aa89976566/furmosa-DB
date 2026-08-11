'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { generateMorningPlanPreviewUxAction } from '@/lib/line/morning/plan/hq-actions';
import {
  INITIAL_MORNING_PLAN_PREVIEW_UX_STATE,
  type MorningPlanPreviewUxState,
} from '@/lib/line/morning/plan/hq-action-state';
import { formatDateTime } from '@/lib/format';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      data-capability="capability-plan-preview"
    >
      {pending ? '正在檢查…' : '重新產生預覽計畫（不會發送）'}
    </Button>
  );
}

function formatCompletedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDateTime(d);
}

export function PlanGenerateForm({
  initialLastCheckedAt,
}: {
  initialLastCheckedAt: string | null;
}) {
  const [state, formAction] = useFormState(
    generateMorningPlanPreviewUxAction,
    INITIAL_MORNING_PLAN_PREVIEW_UX_STATE,
  );
  const [stableCompletedAt, setStableCompletedAt] = useState<string | null>(
    initialLastCheckedAt,
  );
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === 'success' && state.completedAt) {
      setStableCompletedAt(state.completedAt);
    }
    // error：不得更新 completedAt
  }, [state]);

  const displayCompletedAt =
    state.status === 'success' && state.completedAt
      ? state.completedAt
      : stableCompletedAt;

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <SubmitButton />
      </form>
      <div
        ref={liveRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-sm"
      >
        {state.status === 'idle' ? (
          displayCompletedAt ? (
            <p className="text-muted-foreground">
              最後檢查時間：{formatCompletedAt(displayCompletedAt)}
            </p>
          ) : (
            <p className="text-muted-foreground">尚未執行今日檢查。</p>
          )
        ) : null}
        {state.status === 'success' ? (
          <p>
            <span className="font-medium text-foreground">{state.message}</span>
            {state.completedAt ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                完成時間：{formatCompletedAt(state.completedAt)}
              </span>
            ) : null}
          </p>
        ) : null}
        {state.status === 'error' ? (
          <p className="text-destructive" role="alert">
            {state.message || '檢查失敗，請稍後再試'}
            {stableCompletedAt ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                上次成功檢查：{formatCompletedAt(stableCompletedAt)}（未更新）
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {state.status === 'success' ? (
        <PlanUxCounts state={state} />
      ) : null}
    </div>
  );
}

function PlanUxCounts({ state }: { state: MorningPlanPreviewUxState }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div className="rounded-md border p-2">
        <dt className="text-muted-foreground">預計產生</dt>
        <dd className="text-base font-semibold tabular-nums">{state.plannedCount}</dd>
      </div>
      <div className="rounded-md border p-2">
        <dt className="text-muted-foreground">略過</dt>
        <dd className="text-base font-semibold tabular-nums">{state.skippedCount}</dd>
      </div>
      <div className="rounded-md border p-2">
        <dt className="text-muted-foreground">異常</dt>
        <dd className="text-base font-semibold tabular-nums">{state.errorCount}</dd>
      </div>
      <div className="rounded-md border p-2">
        <dt className="text-muted-foreground">交易讓路</dt>
        <dd className="text-base font-semibold tabular-nums">
          {state.transactionalSuppressedCount}
        </dd>
      </div>
    </dl>
  );
}
