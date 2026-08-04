import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { HqTodayOpsRow } from '@/features/dashboard/today-ops';
import { cn } from '@/lib/utils';

function countLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function HqTodayOps({
  rows,
  warnings = [],
}: {
  rows: HqTodayOpsRow[];
  warnings?: string[];
}) {
  const actionRows = rows.filter((r) => r.id !== 'done-today');
  const doneRow = rows.find((r) => r.id === 'done-today');

  return (
    <div className="space-y-3">
      {warnings.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          部分佇列暫時讀不到（{warnings.join('、')}），其餘仍可處理。
        </p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {actionRows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className={cn(
                'flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40',
                row.count > 0 && row.urgency === 'action' && 'bg-amber-50/60 dark:bg-amber-950/20',
              )}
            >
              <span
                className={cn(
                  'flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-base font-semibold tabular-nums',
                  row.count > 0
                    ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-label={`${row.title} ${row.count} 筆`}
              >
                {countLabel(row.count)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {row.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {row.description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {doneRow ? (
        <Link
          href={doneRow.href}
          className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <span>
            {doneRow.title}
            <span className="ml-2 font-semibold tabular-nums text-foreground">
              {countLabel(doneRow.count)}
            </span>
          </span>
          <span className="text-xs">看出貨紀錄</span>
        </Link>
      ) : null}
    </div>
  );
}
