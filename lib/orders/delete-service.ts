import type { PrismaClient } from '@prisma/client';
import { deletionBlocker, isOrderDeletionReason } from './delete-policy';

export class OrderDeleteError extends Error {}
export async function changeOrderDeletion(db: PrismaClient, input: {
  actorId: string; orderId: string; action: 'delete' | 'restore'; reason: string;
}) {
  return db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { role: true } });
    if (actor?.role !== 'admin') throw new OrderDeleteError('只有管理員可以刪除或還原訂單');
    const key = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!key?.omsStatus || key.source !== 'shopify' || !key.externalStore || !key.externalOrderId) throw new OrderDeleteError('目前僅支援 Shopify OMS 訂單');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify:${key.externalStore}:${key.externalOrderId}`}, 0))`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: key.id }, include: { _count: { select: { shipments: true, merchantStockTxns: true } } } });
    if (input.action === 'delete') {
      if (order.deletedAt) return '此訂單已刪除，沒有重複操作';
      if (!isOrderDeletionReason(input.reason)) throw new OrderDeleteError('請選擇刪除原因');
      const application = await tx.campaignApplication.findFirst({ where: { orderId: order.id }, select: { id: true } });
      const review = await tx.orderReview.findFirst({ where: { orderId: order.id }, select: { id: true } });
      const blocker = deletionBlocker(order, {
        hasCampaignApplication: Boolean(application),
        hasOrderReview: Boolean(review),
        shipmentCount: order._count.shipments,
        merchantStockTxnCount: order._count.merchantStockTxns,
      }, input.reason);
      if (blocker) throw new OrderDeleteError(blocker);
    } else if (!order.deletedAt) return '此訂單未刪除，沒有重複還原';
    await tx.order.update({ where: { id: order.id }, data: {
      deletedAt: input.action === 'delete' ? new Date() : null,
      deletedById: input.action === 'delete' ? input.actorId : null,
      deletionReason: input.action === 'delete' ? input.reason : null,
      omsStatus: 'NEW', omsReviewedAt: null, omsReviewedById: null,
      omsCheckedAt: null, omsCheckedSourceUpdatedAt: null,
    } });
    await tx.statusAuditLog.create({ data: { entityType: 'order_deletion', entityId: order.id,
      actorType: 'user', actorId: input.actorId, newStatus: input.action === 'delete' ? 'DELETED' : 'RESTORED',
      metadataJson: JSON.stringify({ reason: input.reason, previousReason: order.deletionReason, previousStatus: order.omsStatus }) } });
    return input.action === 'delete' ? '已從 HQ 刪除，可在「已刪除」清單還原；Shopify 原單不變' : '已還原，請重新檢查與審核';
  }, { maxWait: 2000, timeout: 10000 });
}
