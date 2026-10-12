import { prisma } from '@/lib/prisma';

export type TaskAssignee = { id: string; name: string };
export type TodayTaskRow = {
  id: string;
  taskId: string;
  title: string;
  status: string;
  completedAt: string | null;
  assignee: TaskAssignee | null;
};

const TAIPEI_TZ = 'Asia/Taipei';

export function todayRange() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const day = `${y}-${m}-${d}`;
  return { start: new Date(`${day}T00:00:00+08:00`), end: new Date(`${day}T23:59:59.999+08:00`) };
}

export function endOfToday(): Date {
  return todayRange().end;
}

export async function getTodayTasksForDashboard(): Promise<TodayTaskRow[]> {
  const { start, end } = todayRange();
  const rows = await prisma.task.findMany({
    where: { OR: [{ dueDate: { gte: start, lte: end } }, { createdAt: { gte: start, lte: end } }] },
    select: { id: true, taskId: true, title: true, status: true, completedAt: true, assignee: { select: { id: true, name: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  });
  return rows.map((row) => ({ ...row, completedAt: row.completedAt ? row.completedAt.toISOString() : null }));
}

export async function getTaskAssignees(): Promise<TaskAssignee[]> {
  return prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
}
