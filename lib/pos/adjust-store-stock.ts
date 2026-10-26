import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { merchantStockUniqueWhere } from '@/lib/merchant-stock-key';
import { nextStockTxnNumber } from '@/lib/merchant-stock-txn-number';
import { planProductStockAdjustment } from '@/lib/pos/plan-stock-adjustment';

export async function adjustStoreProductQuantity(input: {
  merchantId: string;
  productId: string;
  newQuantity: number;
  expectedQuantity: number;
}, db: PrismaClient = prisma): Promise<{ quantity: number }> {
  if (!Number.isSafeInteger(input.expectedQuantity) || input.expectedQuantity < 0 ||
      !Number.isSafeInteger(input.newQuantity) || input.newQuantity < 0) throw new Error('庫存數量不合法');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pos-counter:${input.merchantId}`},0))`;
    const product = await tx.product.findUnique({ where: { id: input.productId }, select: { id: true } });
    if (!product) throw new Error('商品不存在');
    const rows = await tx.merchantStock.findMany({
      where: { merchantId: input.merchantId, productId: input.productId },
      select: { id: true, tierId: true, quantity: true },
    });
    if (rows.length > 1) throw new Error('這項商品有多種規格，請由 HQ 依規格盤點，不能修改合計數量');
    const current = rows.reduce((sum, row) => sum + row.quantity, 0);
    if (current === input.newQuantity) return { quantity: current };
    if (current !== input.expectedQuantity) throw new Error('庫存已被更新，請重新整理後再盤點');
    const plan = planProductStockAdjustment(rows, input.newQuantity);
    for (const row of plan.nextRows) {
      await tx.merchantStock.upsert({
        where: merchantStockUniqueWhere(input.merchantId, input.productId, row.tierId),
        update: { quantity: row.quantity, lastCountAt: new Date() },
        create: { merchantId: input.merchantId, productId: input.productId, tierId: row.tierId, quantity: row.quantity, lastCountAt: new Date() },
      });
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('merchant-stock-txn-number:v1',0))`;
    await tx.merchantStockTxn.create({ data: {
      txnNumber: await nextStockTxnNumber(tx), merchantId: input.merchantId, productId: input.productId,
      type: 'adjust', quantity: plan.delta, balanceAfter: input.newQuantity,
      note: `盤點清點錯誤更正：${plan.previousTotal} → ${input.newQuantity}`,
    } });
    return { quantity: input.newQuantity };
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 60_000 });
}
