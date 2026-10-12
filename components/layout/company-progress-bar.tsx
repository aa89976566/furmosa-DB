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
  const encouragement =
    progress.shipped >= TARGET
      ? '第一階段完成'
      : progress.shipped === 0
        ? '從第一片開始，一起完成第一階段'
        : `再出貨 ${progress.remaining} 片，就完成第一階段`;

  return (
    <Link
      href="/mission"
      className="order-3 flex min-w-0 basis-full items-center gap-3 rounded-xl border border-emerald-900/20 bg-emerald-950 px-3 py-2 text-white shadow-sm transition-colors hover:bg-emerald-900 sm:order-none sm:basis-auto sm:px-4"
      aria-label={`查看雞霸已出貨進度：本月已出貨 ${progress.shipped} / ${TARGET} 片`}
    >
      <span className="hidden shrink-0 text-sm font-semibold text-emerald-100 sm:inline">雞霸第一階段</span>
      <span className="flex min-w-0 items-baseline gap-1">
        <span className="text-xs text-emerald-200 sm:hidden">本月已出貨</span>
        <span className="text-2xl font-black leading-none tracking-tight sm:text-3xl">{progress.shipped}</span>
        <span className="text-xs font-medium text-emerald-100 sm:text-sm">／{TARGET} 片</span>
      </span>
      <span className="hidden min-w-0 max-w-48 truncate text-xs text-emerald-100 lg:inline">{encouragement}</span>
      <span className="flex min-w-20 flex-1 flex-col gap-1 sm:w-24 sm:flex-none">
        <span className="flex items-center justify-between text-[10px] font-semibold text-emerald-100">
          <span>{progress.percent}%完成</span>
          <span className="hidden md:inline">本週 {progress.week} 片</span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <span className="block h-full rounded-full bg-emerald-300" style={{ width: `${progress.percent}%` }} />
        </span>
      </span>
    </Link>
  );
}
