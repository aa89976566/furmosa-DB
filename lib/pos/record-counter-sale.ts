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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)) {
    throw new Error('結帳識別遺失，請重新開啟本單');
  }
  const payloadHash = createHash('sha256').update(JSON.stringify(requested)).digest('hex');
  const receiptId = `pos-sale:${merchantId}:${submissionKey}`;
  // Load outside the transaction: queued advisory locks must not exhaust the
  // connection pool while waiting for another catalog query on that same pool.
  const catalog = await catalogLoader(merchantId);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${receiptId}, 0))`;
    const existing = await tx.statusAuditLog.findUnique({ where: { id: receiptId } });
    if (existing) {
      const receipt = JSON.parse(existing.metadataJson ?? '{}');
      if (existing.entityType !== 'pos_counter_sale' || existing.actorId !== merchantId ||
          receipt.payloadHash !== payloadHash || !Number.isFinite(receipt.total) ||
          !Number.isInteger(receipt.lineCount) || receipt.lineCount < 1) {
        throw new Error('這張結帳單已完成，內容不同或紀錄無法確認，請先查閱銷售紀錄');
      }
      return { total: receipt.total as number, lineCount: receipt.lineCount as number };
    }
    if (!catalog) throw new Error('找不到店家資料');
    const planned = planCounterSale(requested, catalog.priced);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('merchant-stock-txn-number:v1', 0))`;

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
      const currentStock = await tx.merchantStock.findFirstOrThrow({
        where: { merchantId, productId: line.productId, tierId: line.tierId },
        select: { quantity: true },
      });
      await tx.merchantStockTxn.create({
        data: {
          txnNumber: txnNumbers[i]!,
          merchantId,
          productId: line.productId,
          tierId: line.tierId,
          type: 'sale',
          quantity: -line.qty,
          balanceAfter: currentStock.quantity,
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
  }, { maxWait: 10_000, timeout: 15_000 });
}
