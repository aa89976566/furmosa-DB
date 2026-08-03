import Link from 'next/link';
import type { TodayTaskRow } from '@/lib/pos/today-dashboard';

export function TodayTaskRowLink({ row }: { row: TodayTaskRow }) {
  return (
    <Link
      href={row.href}
      className="group flex min-h-[64px] items-center justify-between gap-3 border-b border-border/70 py-4 first:pt-1 last:border-b-0"
    >
      <div className="min-w-0">
        <p className="font-medium text-ink group-hover:text-primary">{row.title}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{row.subtitle}</p>
      </div>
      {'badge' in row && row.badge ? (
        <span className="shrink-0 font-display text-xl font-semibold tabular-nums text-primary">
          {row.badge}
        </span>
      ) : (
        <span className="shrink-0 text-sm text-muted-foreground group-hover:text-primary">→</span>
      )}
    </Link>
  );
}
