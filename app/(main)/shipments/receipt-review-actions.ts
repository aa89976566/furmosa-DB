'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadReceiptReviewIds } from '@/lib/pos/receipt-review';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/** Administrative closure only: never calls the stock-posting receipt service. */
export async function closeCountedHistoricalReceipt(form: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new Error('僅 HQ 管理員可核對舊收貨單');
  const actor = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
  if (actor?.role !== 'admin') throw new Error('僅 HQ 管理員可核對舊收貨單');
  const shipmentId = String(form.get('shipmentId') ?? '');
  const reason = String(form.get('reason') ?? '').trim();
  if (form.get('confirmedCounted') !== 'on' || reason.length < 5 || reason.length > 1000) throw new Error('請確認已包含於目前庫存，並填寫5至1000字核對說明');
  await prisma.$transaction(async tx => {
    const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, type: 'merchant_restock' } });
    if (!shipment?.merchantId) throw new Error('找不到店家補貨單');
    if (shipment.status === 'received') return;
    if (!(await loadReceiptReviewIds(shipment.merchantId, [shipment.id], tx, true)).has(shipment.id)) throw new Error('這張出貨單不符合舊單核對條件');
    const updated = await tx.shipment.updateMany({
      where: { id: shipment.id, status: shipment.status, merchantId: shipment.merchantId },
      data: { status: 'received', receivedAt: new Date() },
    });
    if (updated.count !== 1) throw new Error('出貨狀態已變更，請重新核對');
    await tx.statusAuditLog.create({ data: {
      entityType: 'shipment', entityId: shipment.id, previousStatus: shipment.status,
      newStatus: 'received', actorType: 'supervisor', actorId: user.userId,
      metadataJson: JSON.stringify({ source: 'hq_counted_receipt_review', reason, inventoryPosted: false, receiptTimeIsReconciliationTime: true }),
    } });
  }, { isolationLevel: 'Serializable' });
  for (const path of ['/pos','/pos/stock','/pos/notifications','/shipments',`/shipments/${shipmentId}`,`/pos/shipments/${shipmentId}`]) revalidatePath(path);
  redirect(`/shipments/${shipmentId}`);
}
