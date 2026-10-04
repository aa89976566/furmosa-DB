import type { Prisma } from '@prisma/client';

/** Hold the customer row lock through deletion to serialize concurrent FK writes. */
export async function protectCustomerHistory(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${id} FOR UPDATE`;
  const counts = await Promise.all([
    tx.jarCode.count({ where: { redeemedByCustomerId: id } }),
    tx.memberPointsLedger.count({ where: { customerId: id } }),
    tx.rewardRedemption.count({ where: { customerId: id } }),
    tx.refillOrder.count({ where: { customerId: id } }),
    tx.order.count({ where: { customerId: id } }),
    tx.subscription.count({ where: { customerId: id } }),
  ]);
  if (counts.some(Boolean)) throw new Error('此會員已有交易、序號、點數或換罐紀錄，請保留會員以維持完整歷史');
}
