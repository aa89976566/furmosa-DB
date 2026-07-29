import Link from 'next/link';
import type { TodayTaskRow } from '@/lib/pos/today-dashboard';
import { Card, CardContent } from '@/components/ui/card';

export function TodayTaskRowLink({ row }: { row: TodayTaskRow }) {
  return (
    <Link href={row.href} className="block">
      <Card className="shadow-card transition hover:border-primary/40">
        <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="truncate text-sm text-muted-foreground">{row.subtitle}</p>
          </div>
          {'badge' in row && row.badge ? (
            <span className="shrink-0 text-lg font-semibold text-primary">{row.badge}</span>
          ) : (
            <span className="shrink-0 text-sm text-primary">查看</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
