import { Prisma, type PrismaClient } from '@prisma/client';
import { parseReceiptDate } from './receipt-date';

/** Fill missing metadata only. Never invoke stock or costing services here. */
export async function completeReceiptMetadata(db: PrismaClient, input: {
  receiptId: string; vendorId: string; date: string; actorId: string; actorName: string;
}) {
  const date = parseReceiptDate(input.date);
  const vendorId = input.vendorId.trim() || null;
  return db.$transaction(async tx => {
    const receipt = await tx.purchaseReceipt.findUniqueOrThrow({ where: { id: input.receiptId } });
    if (receipt.vendorId && vendorId && receipt.vendorId !== vendorId) throw new Error('既有廠商不能從補資料流程覆寫');
    if (receipt.receiptDate && date && receipt.receiptDate.getTime() !== date.getTime()) throw new Error('既有日期不能從補資料流程覆寫');
    const nextVendor = receipt.vendorId ?? vendorId;
    const nextDate = receipt.receiptDate ?? date;
    if (nextVendor === receipt.vendorId && nextDate === receipt.receiptDate) return;
    if (vendorId && !await tx.vendor.findFirst({ where: { id: vendorId, status: 'active' }, select: { id: true } })) throw new Error('廠商不存在或已停用');
    await tx.purchaseReceipt.update({ where: { id: receipt.id }, data: { vendorId: nextVendor, receiptDate: nextDate } });
    await tx.purchaseReceiptMetadataChange.create({ data: {
      receiptId: receipt.id, actorId: input.actorId, actorName: input.actorName,
      before: { vendorId: receipt.vendorId, receiptDate: receipt.receiptDate?.toISOString() ?? null },
      after: { vendorId: nextVendor, receiptDate: nextDate?.toISOString() ?? null },
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
