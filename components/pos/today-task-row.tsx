import Link from 'next/link';
import type { TodayTaskRow } from '@/lib/pos/today-dashboard';

export function TodayTaskRowLink({ row }: { row: TodayTaskRow }) {
  return (
    <Link href={row.href} className="block transition hover:bg-[#fafafa]">
      <div className="flex min-h-[76px] items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="truncate text-sm text-muted-foreground">{row.subtitle}</p>
        </div>
        {'badge' in row && row.badge ? (
          <span className="flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[#191919] px-2 text-sm font-semibold text-white">
            {row.badge}
          </span>
        ) : (
          <span className="shrink-0 text-lg font-medium text-[#191919]" aria-hidden="true">
            ›
          </span>
        )}
      </div>
    </Link>
  );
}
