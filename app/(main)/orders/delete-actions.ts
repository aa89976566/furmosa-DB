'use server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { changeOrderDeletion, OrderDeleteError } from '@/lib/orders/delete-service';
import { revalidatePath } from 'next/cache';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

export async function orderDeletionAction(_state: { message: string }, form: FormData) {
  const user = await getCurrentUser();
  if (!user) return { message: '請先登入 HQ' };
  const action = form.get('action');
  if (action !== 'delete' && action !== 'restore') return { message: '不支援的操作' };
  const orderId = String(form.get('orderId') ?? '');
  try {
    const message = await changeOrderDeletion(prisma, { actorId: user.userId, orderId, action,
      reason: String(form.get('reason') ?? '') });
    for (const path of ['/orders', `/orders/${orderId}`, '/reviews', '/dashboard']) revalidatePath(path);
    await bustCacheTags(CACHE_TAGS.orderHubTotals, CACHE_TAGS.dashboard);
    return { message };
  } catch (error) { return { message: error instanceof OrderDeleteError ? error.message : '操作未確認完成，請重新整理核對訂單狀態' }; }
}
