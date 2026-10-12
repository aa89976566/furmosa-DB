'use server';

import { prisma } from '@/lib/prisma';
import { endOfToday, type TodayTaskRow } from '@/lib/dashboard-tasks';
import { revalidatePath } from 'next/cache';
import { createHash } from 'node:crypto';

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


export type TaskAttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  dataUrl: string;
};

export type TaskDetails = {
  id: string;
  title: string;
  description: string | null;
  assignee: { id: string; name: string } | null;
  attachments: TaskAttachmentView[];
};

export async function getTaskDetails(taskId: string): Promise<TaskDetails> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      assignee: { select: { id: true, name: true } },
      attachments: {
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, data: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!task) throw new Error('工作不存在');
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    attachments: task.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt.toISOString(),
      dataUrl: `data:${attachment.mimeType};base64,${Buffer.from(attachment.data).toString('base64')}`,
    })),
  };
}

export async function updateTaskDescription(taskId: string, description: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw new Error('工作不存在');
  await prisma.task.update({ where: { id: taskId }, data: { description: description.trim() || null } });
  refreshTasks();
}

export async function addTaskAttachment(taskId: string, formData: FormData) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw new Error('工作不存在');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('請選擇圖片');
  if (!file.type.startsWith('image/')) throw new Error('目前只支援圖片');
  if (file.size > 5 * 1024 * 1024) throw new Error('圖片不能超過 5 MB');
  const data = Buffer.from(await file.arrayBuffer());
  await prisma.taskAttachment.create({
    data: {
      taskId,
      fileName: file.name.slice(0, 180),
      mimeType: file.type,
      sizeBytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      data,
    },
  });
  refreshTasks();
}
