'use server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { canReviewWishes, wishStatus } from '@/lib/guide/wishes';

export async function reviewWish(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!canReviewWishes(user?.role)) throw new Error('沒有許願審核權限');
  const taskId = String(form.get('taskId') ?? '');
  if (!/^WISH-[a-f0-9]{32}$/.test(taskId)) throw new Error('許願編號無效');
  const status = wishStatus(form.get('status'));
  const result = await prisma.task.updateMany({ where: { taskId, type: 'customer_service', reference: { startsWith: 'FMWISH:' } },
    data: { status, completedAt: status === 'done' ? new Date() : null } });
  if (result.count !== 1) throw new Error('找不到這筆許願');
  revalidatePath('/wishes'); revalidatePath('/tasks');
}
