import type { Prisma } from '@prisma/client';

/** The refill ledger counts jars; mirror that same delivery in POS product inventory.
 * Called inside the existing paid delivery transaction, never as a second sale.
 */
export async function deductCountedRefillProductStock(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; productId: string; quantity: number; orderId: string },
): Promise<void> {
  const stocks = await tx.merchantStock.findMany({
    where: { merchantId: input.merchantId, productId: input.productId, quantity: { gt: 0 } },
    orderBy: { id: 'asc' },
  });
  if (stocks.reduce((total, stock) => total + stock.quantity, 0) < input.quantity) {
    throw new Error('換罐品項庫存不一致，請重新確認庫存。');
  }
  let remaining = input.quantity;
  for (const stock of stocks) {
    if (remaining === 0) break;
    const take = Math.min(remaining, stock.quantity);
    const updated = await tx.merchantStock.updateMany({
      where: { id: stock.id, quantity: stock.quantity },
      data: { quantity: { decrement: take }, lastSaleAt: new Date() },
    });
    if (updated.count !== 1) throw new Error('換罐品項庫存已變動，請重新整理。');
    await tx.merchantStockTxn.create({
      data: {
        merchantId: input.merchantId, productId: input.productId, tierId: stock.tierId,
        txnNumber: `REFILL-${input.orderId}-${stock.id}`,
        type: 'adjust', quantity: -take, balanceAfter: stock.quantity - take,
        unitPrice: 0, commissionAmount: 0, companyRevenue: 0, settlementQuantity: 0,
        note: `換罐交付 ${input.orderId}；同步同一批罐裝庫存，營收由換罐訂單記錄，不重複請款。`,
      },
    });
    remaining -= take;
  }
}
