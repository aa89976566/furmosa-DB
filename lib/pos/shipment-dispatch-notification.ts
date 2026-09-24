import type { Prisma } from '@prisma/client';

export const SHIPMENT_DISPATCH_KIND = 'shipment_shipped';
export const SHIPMENT_RECEIPT_DAY_3_KIND = 'shipment_receipt_day_3';
export const SHIPMENT_RECEIPT_DAY_5_KIND = 'shipment_receipt_day_5';
export const MERCHANT_SHIPMENT_NOTIFICATION_KINDS = [
  SHIPMENT_DISPATCH_KIND,
  SHIPMENT_RECEIPT_DAY_3_KIND,
  SHIPMENT_RECEIPT_DAY_5_KIND,
] as const;
// 匠寵寄出後就交由店家確認收貨，不再等待 HQ 標記「送達」。
export const VISIBLE_DISPATCH_STATUSES = ['shipped'];

export function unreadDispatchScope(identity: { merchantId: string; merchantUserId: string }) {
  return {
    merchantId: identity.merchantId,
    kind: { in: [...MERCHANT_SHIPMENT_NOTIFICATION_KINDS] },
    shipment: {
      merchantId: identity.merchantId,
      type: 'merchant_restock',
      status: { in: VISIBLE_DISPATCH_STATUSES },
    },
    reads: { none: { merchantUserId: identity.merchantUserId } },
  };
}

export function dispatchNoticeScope(identity: { merchantId: string }, notificationId: string) {
  return {
    id: notificationId,
    merchantId: identity.merchantId,
    kind: { in: [...MERCHANT_SHIPMENT_NOTIFICATION_KINDS] },
    shipment: { merchantId: identity.merchantId, type: 'merchant_restock' },
  };
}

export function shouldRecordMerchantDispatch(input: {
  type: string;
  merchantId: string | null;
  previousStatus: string;
  nextStatus: string;
}) {
  return input.type === 'merchant_restock' &&
    Boolean(input.merchantId) &&
    input.previousStatus !== 'shipped' &&
    input.nextStatus === 'shipped';
}

/** Run inside the same transaction as the shipment transition. No historical backfill. */
export async function recordMerchantDispatch(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; shipmentId: string; occurredAt: Date },
) {
  const notification = await tx.merchantNotification.upsert({
    where: {
      shipmentId_kind: { shipmentId: input.shipmentId, kind: SHIPMENT_DISPATCH_KIND },
    },
    create: {
      merchantId: input.merchantId,
      shipmentId: input.shipmentId,
      kind: SHIPMENT_DISPATCH_KIND,
      title: '商品已出貨',
      createdAt: input.occurredAt,
    },
    update: {
      // A legitimate return to pending and later re-dispatch is a new unread event.
      createdAt: input.occurredAt,
    },
    select: { id: true },
  });
  await tx.merchantNotificationRead.deleteMany({
    where: { notificationId: notification.id },
  });
}
