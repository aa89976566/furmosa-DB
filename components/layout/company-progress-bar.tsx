import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { defaultTaipeiMonthRange, taipeiWeekRangeSunday } from '@/lib/taipei-date';

const TARGET = 1000;
const SHIPPED_STATUSES = ['shipped', 'delivered'] as const;

async function getShippedProgress() {
  const { start: monthStart } = defaultTaipeiMonthRange();
  const { start: weekStart } = taipeiWeekRangeSunday();

  const [month, week] = await Promise.all([
    prisma.shipmentItem.aggregate({
      _sum: { quantity: true },
      where: {
        product: { name: { contains: '雞霸', mode: 'insensitive' } },
        shipment: { status: { in: [...SHIPPED_STATUSES] }, shippedAt: { gte: monthStart } },
      },
    }),
    prisma.shipmentItem.aggregate({
      _sum: { quantity: true },
      where: {
        product: { name: { contains: '雞霸', mode: 'insensitive' } },
        shipment: { status: { in: [...SHIPPED_STATUSES] }, shippedAt: { gte: weekStart } },
      },
    }),
  ]);

  const shipped = Number(month._sum.quantity ?? 0);
  return { shipped, week: Number(week._sum.quantity ?? 0), percent: Math.min(100, Math.round((shipped / TARGET) * 100)) };
}

export async function CompanyProgressBar() {
  const progress = await getShippedProgress();

  return (
    <Link
      href="/mission"
      className="order-3 flex min-w-0 basis-full items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted sm:order-none sm:basis-auto sm:px-3"
      aria-label={`查看雞霸已出貨進度：本月 ${progress.shipped} / ${TARGET} 片`}
    >
      <span className="shrink-0 font-medium text-navy">雞霸第一階段</span>
      <span className="shrink-0 font-semibold text-emerald-800">{progress.shipped}／{TARGET} 片</span>
      <span className="hidden shrink-0 text-muted-foreground md:inline">本週 {progress.week} 片</span>
      <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-background sm:w-20 sm:flex-none">
        <span className="block h-full rounded-full bg-emerald-700" style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="shrink-0 text-muted-foreground">{progress.percent}%</span>
    </Link>
  );
}
