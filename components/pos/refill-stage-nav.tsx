import {
  REFILL_FLOW_STAGES,
  refillFlowStageState,
  type RefillFlowStageId,
} from '@/lib/pos/refill-view';

export function RefillStageNav({ current }: { current: RefillFlowStageId }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {REFILL_FLOW_STAGES.map((stage, index) => {
        const state = refillFlowStageState(stage.id, current);
        const stateLabel = state === 'done' ? '已完成' : state === 'current' ? '目前' : '尚未開始';
        return (
          <li
            key={stage.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`rounded-2xl border px-3 py-3 ${
              state === 'current'
                ? 'border-zinc-900 bg-white'
                : state === 'done'
                  ? 'border-neutral-200 bg-neutral-50'
                  : 'border-dashed border-neutral-200 bg-white text-zinc-500'
            }`}
          >
            <p className="text-sm text-zinc-500">
              第 {index + 1} 步 · {stateLabel}
            </p>
            <p className="mt-1 text-base font-semibold text-zinc-900">{stage.label}</p>
          </li>
        );
      })}
    </ol>
  );
}
