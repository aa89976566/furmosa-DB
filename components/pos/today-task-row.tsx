import Link from 'next/link';
import type { TodayTaskRow } from '@/lib/pos/today-dashboard';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Package,
  Truck,
  UserRound,
} from 'lucide-react';

const KIND_META: Record<
  TodayTaskRow['kind'],
  { icon: typeof UserRound; tone: string; iconTone: string }
> = {
  pending_confirm: {
    icon: CalendarClock,
    tone: 'bg-coral/10',
    iconTone: 'text-coral',
  },
  next_guest: {
    icon: UserRound,
    tone: 'bg-info/10',
    iconTone: 'text-info',
  },
  pending_refill: {
    icon: Package,
    tone: 'bg-success/10',
    iconTone: 'text-success',
  },
  low_stock: {
    icon: AlertTriangle,
    tone: 'bg-warning/15',
    iconTone: 'text-warning',
  },
  restock_progress: {
    icon: Truck,
    tone: 'bg-secondary',
    iconTone: 'text-navy',
  },
};

export function TodayTaskRowLink({
  row,
  index = 0,
}: {
  row: TodayTaskRow;
  index?: number;
}) {
  const meta = KIND_META[row.kind];
  const Icon = meta.icon;
  const hasBadge = 'badge' in row && !!row.badge;

  return (
    <Link
      href={row.href}
      className="pos-fade-in group block rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
    >
      <div
        className={cn(
          'flex min-h-[76px] items-center gap-3.5 rounded-[1.25rem] border border-border/60 bg-surface-raised px-4 py-3.5 shadow-card',
          'transition-[transform,box-shadow,border-color] duration-200 ease-out',
          'group-hover:border-coral/35 group-hover:shadow-card-hover',
          'group-active:scale-[0.99]',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            meta.tone,
            meta.iconTone,
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-pos text-[1.05rem] font-semibold leading-tight tracking-tight text-navy">
            {row.title}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{row.subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {hasBadge ? (
            <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-coral px-2 py-0.5 text-sm font-semibold tabular-nums text-white">
              {row.badge}
            </span>
          ) : (
            <span className="text-sm font-medium text-coral">查看</span>
          )}
          <ChevronRight
            className="h-4 w-4 text-muted-foreground/70 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}
