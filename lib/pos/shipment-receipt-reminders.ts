import { prisma } from '@/lib/prisma';
import {
  SHIPMENT_DISPATCH_KIND,
  SHIPMENT_RECEIPT_DAY_3_KIND,
  SHIPMENT_RECEIPT_DAY_5_KIND,
} from '@/lib/pos/shipment-dispatch-notification';

const DAY_MS = 24 * 60 * 60 * 1000;

export function receiptReminderStage(shippedAt: Date, now: Date): 3 | 5 | null {
  const age = now.getTime() - shippedAt.getTime();
  if (age >= 5 * DAY_MS) return 5;
  if (age >= 3 * DAY_MS) return 3;
  return null;
}

/** 每日補上店家收貨提醒；shipmentId + kind 唯一鍵確保每階段只建立一次。 */
export async function processMerchantReceiptReminders(now = new Date()) {
  const shipments = await prisma.shipment.findMany({
    where: {
      type: 'merchant_restock',
      status: 'shipped',
      merchantId: { not: null },
      shippedAt: { not: null, lte: new Date(now.getTime() - 3 * DAY_MS) },
      receivedAt: null,
    },
    select: { id: true, merchantId: true, shippedAt: true },
  });

  let created = 0;
  for (const shipment of shipments) {
    if (!shipment.merchantId || !shipment.shippedAt) continue;
    const stage = receiptReminderStage(shipment.shippedAt, now);
    if (!stage) continue;
    const kind = stage === 5 ? SHIPMENT_RECEIPT_DAY_5_KIND : SHIPMENT_RECEIPT_DAY_3_KIND;
    const title = stage === 5 ? '再次確認：這批貨收到了嗎？' : '這批貨收到了嗎？';
    const exists = await prisma.merchantNotification.findUnique({
      where: { shipmentId_kind: { shipmentId: shipment.id, kind } },
      select: { id: true },
    });
    if (exists) continue;

    await prisma.$transaction(async (tx) => {
      await tx.merchantNotification.create({
        data: { merchantId: shipment.merchantId!, shipmentId: shipment.id, kind, title, createdAt: now },
      });
      const older = await tx.merchantNotification.findMany({
        where: {
          shipmentId: shipment.id,
          kind: { in: stage === 5
            ? [SHIPMENT_DISPATCH_KIND, SHIPMENT_RECEIPT_DAY_3_KIND]
            : [SHIPMENT_DISPATCH_KIND] },
        },
        select: { id: true },
      });
      const users = await tx.merchantUser.findMany({
        where: { merchantId: shipment.merchantId!, isActive: true },
        select: { id: true },
      });
      if (older.length && users.length) {
        await tx.merchantNotificationRead.createMany({
          data: older.flatMap((notice) => users.map((user) => ({
            notificationId: notice.id,
            merchantUserId: user.id,
          }))),
          skipDuplicates: true,
        });
      }
    });
    created += 1;
  }
  return { checked: shipments.length, created };
}
