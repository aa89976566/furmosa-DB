import { formatDateTime } from '@/lib/format';
import type { FulfillmentTimelineStep } from '@/lib/shipment-dispatch';
import { cn } from '@/lib/utils';

export function FulfillmentTimeline({ steps }: { steps: FulfillmentTimelineStep[] }) {
  return (
    <ol aria-label="出貨進度" className="grid gap-3 sm:grid-cols-5">
      {steps.map((step, index) => (
        <li key={step.key} className="rounded-lg border bg-card px-3 py-2">
          <p className="text-[11px] text-muted-foreground">0{index + 1}</p>
          <p className={cn('text-sm font-medium', step.done ? 'text-foreground' : 'text-muted-foreground')}>
            {step.label}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {step.done && step.at ? formatDateTime(step.at) : step.done ? '已完成' : '尚未完成'}
          </p>
        </li>
      ))}
    </ol>
  );
}
