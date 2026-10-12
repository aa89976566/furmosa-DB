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
  return {
    shipped,
    week: Number(week._sum.quantity ?? 0),
    percent: Math.min(100, Math.round((shipped / TARGET) * 100)),
    remaining: Math.max(0, TARGET - shipped),
  };
}

export async function CompanyProgressBar() {
  const progress = await getShippedProgress();

  return (
    <Link
      href="/mission"
      className="order-3 flex min-w-0 basis-full items-center gap-4 rounded-2xl border border-emerald-900/10 bg-emerald-50 px-4 py-2.5 text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100 sm:order-none sm:min-w-0 sm:flex-1 sm:px-5 sm:py-3"
      aria-label={`查看雞霸已出貨進度：本月已出貨 ${progress.shipped} / ${TARGET} 片`}
    >
      <span className="min-w-0 shrink-0">
        <span className="block text-sm font-bold leading-tight sm:text-base">雞霸第一階段</span>
        <span className="mt-1 block text-xs text-emerald-800 sm:text-sm">一起完成第一階段</span>
      </span>

      <span className="min-w-0 flex-1 border-l border-emerald-900/15 pl-4">
        <span className="flex items-end gap-2">
          <span className="text-xs font-medium text-emerald-800 sm:text-sm">本月已出貨</span>
          <span className="text-3xl font-black leading-none tracking-tight sm:text-4xl">{progress.shipped}</span>
          <span className="pb-0.5 text-xs font-medium text-emerald-800 sm:text-sm">／{TARGET} 片</span>
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-emerald-900/10">
          <span className="block h-full rounded-full bg-emerald-700 transition-[width]" style={{ width: `${progress.percent}%` }} />
        </span>
      </span>

      <span className="shrink-0 border-l border-emerald-900/15 pl-4 text-right">
        <span className="block text-2xl font-black leading-none sm:text-3xl">{progress.percent}%</span>
        <span className="mt-1 block text-xs font-medium text-emerald-800 sm:text-sm">完成</span>
        <span className="mt-1 hidden text-xs text-emerald-800 md:block">本週已出貨 {progress.week} 片</span>
      </span>
    </Link>
  );
}
