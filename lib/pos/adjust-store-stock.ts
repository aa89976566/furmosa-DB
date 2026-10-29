import { prisma } from '@/lib/prisma';
import { merchantStockUniqueWhere } from '@/lib/merchant-stock-key';
import { nextStockTxnNumber } from '@/lib/merchant-stock-txn-number';
import { planProductStockAdjustment } from '@/lib/pos/plan-stock-adjustment';

export async function adjustStoreProductQuantity(input: {
  merchantId: string;
  productId: string;
  newQuantity: number;
  tierId?: string;
}): Promise<{ quantity: number }> {
  return prisma.$transaction(async (tx) => {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, priceTiers: { select: { id: true } } },
  });
  if (!product) throw new Error('商品不存在');

  const rows = await tx.merchantStock.findMany({
    where: { merchantId: input.merchantId, productId: input.productId },
    select: { id: true, tierId: true, quantity: true },
  });
  if (input.tierId === undefined && product.priceTiers.length > 1) throw new Error('請選擇要盤點的規格');
  if (input.tierId !== undefined && !product.priceTiers.some(t => t.id === input.tierId) && !rows.some(r => r.tierId === input.tierId)) throw new Error('規格不存在');
  const tierId = input.tierId ?? rows[0]?.tierId ?? product.priceTiers[0]?.id ?? '';

  const plan = planProductStockAdjustment(
    rows.map((row) => ({ id: row.id, tierId: row.tierId, quantity: row.quantity })),
    input.newQuantity,
    tierId,
  );

  for (const row of plan.nextRows) {
    if (row.tierId !== tierId) continue;
    const where = merchantStockUniqueWhere(input.merchantId, input.productId, row.tierId);
    await tx.merchantStock.upsert({
      where,
      update: { quantity: row.quantity, lastCountAt: new Date() },
      create: {
        merchantId: input.merchantId,
        productId: input.productId,
        tierId: row.tierId,
        quantity: row.quantity,
        lastCountAt: new Date(),
      },
    });
  }

  const quantity = plan.previousTotal + plan.delta;
  await tx.merchantStockTxn.create({
    data: {
      txnNumber: await nextStockTxnNumber(tx),
      merchantId: input.merchantId,
      productId: input.productId,
      type: 'adjust',
      quantity: plan.delta,
      balanceAfter: quantity,
      note: `盤點規格 ${input.tierId ?? '單一規格'}：合計 ${plan.previousTotal} → ${quantity}`,
    },
  });

  return { quantity };
  }, { isolationLevel: 'Serializable' }).catch(error => {
    if (error?.code === 'P2034') throw new Error('庫存已變更，請重新整理後再盤點');
    throw error;
  });
}
