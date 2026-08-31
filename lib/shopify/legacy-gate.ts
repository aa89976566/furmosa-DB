import type { Prisma } from '@prisma/client';

/** Serialize old write paths against intake, then re-read. Prevents a check/write race during enrollment. */
export async function guardLegacyOrderTx(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId },
    select: { externalStore: true, externalOrderId: true } });
  if (!order) throw new Error('訂單不存在');
  if (order.externalStore && order.externalOrderId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify:${order.externalStore}:${order.externalOrderId}`}, 0))`;
  }
  const fresh = await tx.order.findUnique({ where: { id: orderId }, select: { omsStatus: true } });
  if (!fresh || fresh.omsStatus) throw new Error('OMS 訂單不可使用舊的修改或出貨操作，請先完成專用審核');
}
