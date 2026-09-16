'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { archivablePendingOrderWhere, taiwanWeekStart } from '@/lib/orders/archive-policy';

export type ArchiveActionState = { message: string; ok?: boolean };

async function currentUserOrThrow() {
  const user = await getCurrentUser();
  if (!user) throw new Error('請先登入 HQ');
  if (user.role !== 'admin') throw new Error('只有管理員可以封存或恢復訂單');
  return user;
}

function refreshOrderViews(orderId?: string) {
  revalidatePath('/orders');
  revalidatePath('/reviews');
  revalidatePath('/dashboard');
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function orderArchiveAction(
  _state: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  try {
    const user = await currentUserOrThrow();
    const orderId = String(formData.get('orderId') ?? '').trim();
    const action = String(formData.get('action') ?? '').trim();
    if (!orderId) throw new Error('缺少訂單');
    if (action !== 'archive' && action !== 'restore') throw new Error('無效的操作');

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, archivedAt: true, deletedAt: true, status: true, omsStatus: true },
      });
      if (!order) throw new Error('找不到訂單');
      if (order.deletedAt) throw new Error('已移出的訂單不能封存');

      if (action === 'archive') {
        if (order.archivedAt) return;
        if (order.status !== 'pending_review' || (order.omsStatus && !['NEW', 'REVIEW'].includes(order.omsStatus))) {
          throw new Error('只有仍待審核的訂單可以封存');
        }
      } else if (!order.archivedAt) {
        return;
      }

      const now = new Date();
      await tx.order.update({
        where: { id: orderId },
        data: action === 'archive'
          ? { archivedAt: now, archivedById: user.userId }
          : { archivedAt: null, archivedById: null },
      });
      await tx.statusAuditLog.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          previousStatus: action === 'archive' ? 'active' : 'archived',
          newStatus: action === 'archive' ? 'archived' : 'active',
          actorType: 'supervisor',
          actorId: user.userId,
          metadataJson: JSON.stringify({ action, actorName: user.name }),
        },
      });
    });

    refreshOrderViews(orderId);
    return { ok: true, message: action === 'archive' ? '已移至歷史訂單' : '已恢復到待審核' };
  } catch (error) {
    return { message: error instanceof Error ? error.message : '操作失敗' };
  }
}

export async function archiveOlderPendingOrders(
  _state: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  try {
    const user = await currentUserOrThrow();
    if (String(formData.get('confirm') ?? '') !== 'archive-before-week') throw new Error('請重新確認操作');
    const weekStart = taiwanWeekStart();
    const now = new Date();
    const archivedCount = await prisma.$transaction(async (tx) => {
      const ids = await tx.order.findMany({
        where: archivablePendingOrderWhere(weekStart),
        select: { id: true },
      });
      if (ids.length === 0) return 0;
      const orderIds = ids.map((row) => row.id);
      await tx.order.updateMany({
        where: { id: { in: orderIds }, ...archivablePendingOrderWhere(weekStart) },
        data: { archivedAt: now, archivedById: user.userId },
      });
      await tx.statusAuditLog.createMany({
        data: orderIds.map((id) => ({
          entityType: 'order', entityId: id,
          previousStatus: 'active', newStatus: 'archived',
          actorType: 'supervisor', actorId: user.userId,
          metadataJson: JSON.stringify({ action: 'bulk_archive_before_week', actorName: user.name, weekStart: weekStart.toISOString() }),
        })),
      });
      return orderIds.length;
    });
    refreshOrderViews();
    return { ok: true, message: archivedCount === 0 ? '沒有需要封存的舊待審核訂單' : `已將 ${archivedCount} 筆舊待審核訂單移至歷史訂單` };
  } catch (error) {
    return { message: error instanceof Error ? error.message : '操作失敗' };
  }
}
