import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { noteWithSpec } from '@/lib/merchant-product-tier';
import { reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import { planCounterSale, type RequestedCounterLine } from '@/lib/pos/counter-sale-plan';
import { loadCounterCatalog } from '@/lib/pos/counter-catalog';

export async function recordCounterSale(merchantId: string, requested: RequestedCounterLine[], submissionKey: string,
  db: PrismaClient = prisma, catalogLoader: typeof loadCounterCatalog = loadCounterCatalog,
) {
  if (!/^[0-9a-f-]{36}$/i.test(submissionKey)) throw new Error('結帳識別遺失，請重新開啟本單');
  const payloadHash = createHash('sha256').update(JSON.stringify(requested)).digest('hex');
  const receiptId = `pos-sale:${merchantId}:${submissionKey}`;
  return db.$transaction(async (tx) => {
    // Serialize counter sales for this merchant, including same-key retries.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pos-counter:${merchantId}`},0))`;
    const existing = await tx.statusAuditLog.findUnique({ where: { id: receiptId } });
    if (existing) {
      const receipt = JSON.parse(existing.metadataJson ?? '{}');
      if (receipt.payloadHash !== payloadHash) throw new Error('這張結帳單已完成，內容不同，請先查閱銷售紀錄');
      return { total: receipt.total as number, lineCount: receipt.lineCount as number };
    }
    const catalog = await catalogLoader(merchantId);
    if (!catalog) throw new Error('找不到店家資料');
    const planned = planCounterSale(requested, catalog.priced);

    // Serialize counter-sale number reservations across stores. Other writers
    // remain protected by the unique ledger number and atomic rollback.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('merchant-stock-txn-number:v1',0))`;
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
      const stock = await tx.merchantStock.findUniqueOrThrow({
        where: { merchantId_productId_tierId: { merchantId, productId: line.productId, tierId: line.tierId } },
      });
      await tx.merchantStockTxn.create({
        data: {
          txnNumber: txnNumbers[i]!,
          merchantId,
          productId: line.productId,
          type: 'sale',
          quantity: -line.qty,
          balanceAfter: stock.quantity,
          unitPrice: line.unitPrice,
          commissionAmount: line.commissionAmount,
          companyRevenue: line.companyRevenue,
          note: noteWithSpec(line.specLabel, '店家收銀'),
        },
      });
    }

    const result = {
      total: planned.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
      lineCount: planned.length,
    };
    await tx.statusAuditLog.create({ data: {
      id: receiptId, entityType: 'pos_counter_sale', entityId: receiptId,
      newStatus: 'completed', actorType: 'merchant', actorId: merchantId,
      metadataJson: JSON.stringify({ payloadHash, ...result }),
    } });
    return result;
  }, { maxWait: 30_000, timeout: 60_000 });
}
