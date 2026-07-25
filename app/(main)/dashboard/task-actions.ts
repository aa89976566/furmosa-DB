'use server';

import { prisma } from '@/lib/prisma';
import { endOfToday, type TodayTaskRow } from '@/lib/dashboard-tasks';
import { revalidatePath } from 'next/cache';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

async function nextTaskId() {
  const rows = await prisma.task.findMany({
    where: { taskId: { startsWith: 'TASK-' } },
    select: { taskId: true },
  });
  let max = 0;
  for (const { taskId } of rows) {
    const m = taskId.match(/^TASK-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TASK-${pad(max + 1)}`;
}

export async function createTodayTask(title: string): Promise<TodayTaskRow> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('請輸入任務內容');

  const created = await prisma.task.create({
    data: {
      taskId: await nextTaskId(),
      title: trimmed,
      type: 'general',
      status: 'todo',
      priority: 'medium',
      dueDate: endOfToday(),
    },
    select: {
      id: true,
      taskId: true,
      title: true,
      status: true,
      completedAt: true,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/tasks');
  return {
    id: created.id,
    taskId: created.taskId,
    title: created.title,
    status: created.status,
    completedAt: created.completedAt ? created.completedAt.toISOString() : null,
  };
}

export async function toggleTodayTask(taskId: string, done: boolean) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });
  if (!task) throw new Error('任務不存在');

  await prisma.task.update({
    where: { id: taskId },
    data: done
      ? { status: 'done', completedAt: new Date() }
      : { status: 'todo', completedAt: null },
  });

  revalidatePath('/dashboard');
  revalidatePath('/tasks');
}

export async function deleteTodayTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath('/dashboard');
  revalidatePath('/tasks');
}
