import { prisma } from '@/lib/prisma';
import { withDbRetry } from '@/lib/prisma-retry';

export type TodayTaskRow = {
  id: string;
  taskId: string;
  title: string;
  status: string;
  completedAt: Date | null;
};

const TAIPEI_TZ = 'Asia/Taipei';

/** 儀表板「今日任務」日期區間（台北日曆日，避免 UTC 錯日） */
export function todayRange() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const day = `${y}-${m}-${d}`;
  return {
    start: new Date(`${day}T00:00:00+08:00`),
    end: new Date(`${day}T23:59:59.999+08:00`),
  };
}

export function endOfToday(): Date {
  return todayRange().end;
}

export async function getTodayTasksForDashboard(): Promise<TodayTaskRow[]> {
  const { start, end } = todayRange();
  return withDbRetry(() =>
    prisma.task.findMany({
      where: {
        OR: [
          { dueDate: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      select: {
        id: true,
        taskId: true,
        title: true,
        status: true,
        completedAt: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    }),
  );
}
