import { prisma } from '@/lib/prisma';
import { merchantStockUniqueWhere } from '@/lib/merchant-stock-key';
import { nextStockTxnNumber } from '@/lib/merchant-stock-txn-number';
import { planProductStockAdjustment } from '@/lib/pos/plan-stock-adjustment';

export async function adjustStoreProductQuantity(input: {
  merchantId: string;
  productId: string;
  newQuantity: number;
}): Promise<{ quantity: number }> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true },
  });
  if (!product) throw new Error('商品不存在');

  const rows = await prisma.merchantStock.findMany({
    where: { merchantId: input.merchantId, productId: input.productId },
    select: { id: true, tierId: true, quantity: true },
  });

  const plan = planProductStockAdjustment(
    rows.map((row) => ({ id: row.id, tierId: row.tierId, quantity: row.quantity })),
    input.newQuantity,
  );

  for (const row of plan.nextRows) {
    const where = merchantStockUniqueWhere(input.merchantId, input.productId, row.tierId);
    await prisma.merchantStock.upsert({
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

  await prisma.merchantStockTxn.create({
    data: {
      txnNumber: await nextStockTxnNumber(prisma),
      merchantId: input.merchantId,
      productId: input.productId,
      type: 'adjust',
      quantity: plan.delta,
      balanceAfter: input.newQuantity,
      note: `盤點清點錯誤更正：${plan.previousTotal} → ${input.newQuantity}`,
    },
  });

  return { quantity: input.newQuantity };
}
