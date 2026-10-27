import { Prisma, type PrismaClient } from '@prisma/client';

export async function cancelUnreceivedPurchaseOrder(db: PrismaClient, id: string, reason: string, actorId: string) {
  reason = reason.trim();
  if (!id || !actorId || !reason || reason.length > 500) throw new Error('請填寫 1 至 500 字的作廢原因');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
    const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { receipt: { select: { id: true } }, _count: { select: { receipts: true } } } });
    if (!order) throw new Error('找不到採購單');
    if (order.status === 'cancelled') return;
    if (order.status !== 'pending_receipt' || order.receipt || order._count.receipts || order.receivedAt) {
      throw new Error('此單已有收貨紀錄或已完成，不能作廢；請由管理員核對入庫與成本');
    }
    await tx.purchaseOrder.update({ where: { id }, data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason } });
    await tx.statusAuditLog.create({ data: { entityType: 'purchase_order', entityId: id,
      previousStatus: order.status, newStatus: 'cancelled', actorType: 'user', actorId,
      metadataJson: JSON.stringify({ reason, orderNumber: order.orderNumber }) } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
