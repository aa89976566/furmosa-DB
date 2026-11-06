import type { Prisma } from '@prisma/client';

/** The refill ledger counts jars; mirror that same delivery in POS product inventory.
 * Called inside the existing paid delivery transaction, never as a second sale.
 */
export async function deductCountedRefillProductStock(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; productId: string; quantity: number; orderId: string; allowUntrackedStock?: boolean },
): Promise<void> {
  const stocks = await tx.merchantStock.findMany({
    where: { merchantId: input.merchantId, productId: input.productId },
    orderBy: { id: 'asc' },
  });
  // Legacy refill-only stores may have no POS product stock row at all.
  // An existing zero row is tracked inventory and must still reject a delivery.
  if (stocks.length === 0 && input.allowUntrackedStock) return;
  if (stocks.reduce((total, stock) => total + stock.quantity, 0) < input.quantity) {
    throw new Error('換罐品項庫存不一致，請重新確認庫存。');
  }
  let remaining = input.quantity;
  for (const stock of stocks) {
    if (remaining === 0) break;
    if (stock.quantity <= 0) continue;
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

/** Mirror a mapped flavour regardless of whether its label declares grams. */
export async function deductLinkedRefillProductStock(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; flavourId: string; weightGrams: number; quantity: number; orderId: string },
): Promise<void> {
  // Existing product_id link is not yet represented in the Prisma model.
  const links = await tx.$queryRaw<Array<{ product_id: string | null }>>`
    SELECT product_id FROM refill_flavours WHERE id = ${input.flavourId}
  `;
  if (!links[0]?.product_id) return;
  await deductCountedRefillProductStock(tx, {
    merchantId: input.merchantId, productId: links[0].product_id,
    quantity: input.quantity, orderId: input.orderId,
    allowUntrackedStock: input.weightGrams > 0,
  });
}
