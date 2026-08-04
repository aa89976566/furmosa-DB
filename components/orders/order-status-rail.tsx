import { orderStatusLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const RAIL = [
  { key: 'draft', label: orderStatusLabel.draft },
  { key: 'confirmed', label: orderStatusLabel.confirmed },
  { key: 'shipped', label: orderStatusLabel.shipped },
  { key: 'completed', label: orderStatusLabel.completed },
] as const;

function railIndex(status: string) {
  if (status === 'cancelled') return -1;
  if (status === 'draft') return 0;
  if (status === 'confirmed' || status === 'packed') return 1;
  if (status === 'shipped' || status === 'delivered') return 2;
  if (status === 'completed') return 3;
  return 0;
}

/** 視覺進度軌（非操作）；調整狀態仍用下方 toggles */
export function OrderStatusRail({ status }: { status: string }) {
  const active = railIndex(status);
  if (status === 'cancelled') {
    return (
      <p className="rounded-xl bg-muted px-3 py-2 text-sm font-medium text-ink">已取消</p>
    );
  }

  return (
    <ol className="grid grid-cols-4 gap-1">
      {RAIL.map((step, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <li
            key={step.key}
            className={cn(
              'rounded-xl px-2 py-2.5 text-center text-[11px] font-medium sm:text-xs',
              isActive && 'bg-ink text-white',
              isDone && !isActive && 'bg-muted text-ink',
              !isActive && !isDone && 'bg-muted/50 text-muted-foreground',
            )}
          >
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
