'use server';

import { prisma } from '@/lib/prisma';
import { endOfToday, type TodayTaskRow } from '@/lib/dashboard-tasks';
import { revalidatePath } from 'next/cache';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

async function nextTaskId() {
  const rows = await prisma.task.findMany({ where: { taskId: { startsWith: 'TASK-' } }, select: { taskId: true } });
  let max = 0;
  for (const { taskId } of rows) {
    const m = taskId.match(/^TASK-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TASK-${pad(max + 1)}`;
}

function refreshTasks() {
  revalidatePath('/dashboard');
  revalidatePath('/tasks');
}

export async function createTodayTask(title: string, assigneeId?: string): Promise<TodayTaskRow> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('請輸入工作內容');
  const created = await prisma.task.create({
    data: {
      taskId: await nextTaskId(),
      title: trimmed,
      type: 'general',
      status: 'todo',
      priority: 'medium',
      dueDate: endOfToday(),
      assigneeId: assigneeId || undefined,
    },
    include: { assignee: { select: { id: true, name: true } } },
  });
  refreshTasks();
  return {
    id: created.id,
    taskId: created.taskId,
    title: created.title,
    status: created.status,
    completedAt: created.completedAt ? created.completedAt.toISOString() : null,
    assignee: created.assignee,
  };
}

export async function toggleTodayTask(taskId: string, done: boolean) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw new Error('工作不存在');
  await prisma.task.update({
    where: { id: taskId },
    data: done ? { status: 'done', completedAt: new Date() } : { status: 'todo', completedAt: null },
  });
  refreshTasks();
}

export async function assignTodayTask(taskId: string, assigneeId: string | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw new Error('工作不存在');
  if (assigneeId) {
    const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
    if (!user) throw new Error('找不到這位協作者');
  }
  await prisma.task.update({ where: { id: taskId }, data: { assigneeId: assigneeId || null } });
  refreshTasks();
}

export async function deleteTodayTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
  refreshTasks();
}
