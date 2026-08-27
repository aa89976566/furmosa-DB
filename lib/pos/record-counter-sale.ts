import { prisma } from '@/lib/prisma';
import { noteWithSpec } from '@/lib/merchant-product-tier';
import { reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import { planCounterSale, type RequestedCounterLine } from '@/lib/pos/counter-sale-plan';
import { loadCounterCatalog } from '@/lib/pos/counter-catalog';

export async function recordCounterSale(merchantId: string, requested: RequestedCounterLine[]) {
  const catalog = await loadCounterCatalog(merchantId);
  if (!catalog) {
    throw new Error('找不到店家資料');
  }
  const planned = planCounterSale(requested, catalog.priced);

  return prisma.$transaction(async (tx) => {
    const txnNumbers = await reserveStockTxnNumbers(tx, planned.length);
    const now = new Date();

    for (let i = 0; i < planned.length; i++) {
      const line = planned[i]!;
      const updated = await tx.merchantStock.updateMany({
        where: {
          merchantId,
          productId: line.productId,
          tierId: line.tierId,
          quantity: { gte: line.qty },
        },
        data: {
          quantity: { decrement: line.qty },
          lastSaleAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new Error(`${line.name} 庫存不足`);
      }
      await tx.merchantStockTxn.create({
        data: {
          txnNumber: txnNumbers[i]!,
          merchantId,
          productId: line.productId,
          type: 'sale',
          quantity: -line.qty,
          balanceAfter: line.balanceAfter,
          unitPrice: line.unitPrice,
          commissionAmount: line.commissionAmount,
          companyRevenue: line.companyRevenue,
          note: noteWithSpec(line.specLabel, '店家收銀'),
        },
      });
    }

    return {
      total: planned.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
      lineCount: planned.length,
    };
  });
}
