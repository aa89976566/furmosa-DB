import { prisma } from '@/lib/prisma';
import {
  dispatchNoticeScope,
  unreadDispatchScope,
} from '@/lib/pos/shipment-dispatch-notification';

export type MerchantNotificationIdentity = {
  merchantId: string;
  merchantUserId: string;
};

async function assertActiveMerchantUser(identity: MerchantNotificationIdentity) {
  const user = await prisma.merchantUser.findFirst({
    where: {
      id: identity.merchantUserId,
      merchantId: identity.merchantId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!user) throw new Error('店家帳號無法讀取通知，請重新登入');
}

export async function loadMerchantNotificationInbox(
  identity: MerchantNotificationIdentity,
  take = 5,
) {
  await assertActiveMerchantUser(identity);
  const where = unreadDispatchScope(identity);
  const [unreadCount, notifications] = await Promise.all([
    prisma.merchantNotification.count({ where }),
    prisma.merchantNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        kind: true,
        title: true,
        createdAt: true,
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            restockRequest: { select: { id: true } },
          },
        },
      },
    }),
  ]);
  return {
    unreadCount,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      shipmentId: notification.shipment.id,
      shipmentNumber: notification.shipment.shipmentNumber,
      occurredAt: notification.createdAt.toISOString(),
      href: notification.shipment.restockRequest
        ? `/pos/restock/${notification.shipment.restockRequest.id}`
        : `/pos/shipments/${notification.shipment.id}`,
    })),
  };
}

export async function markMerchantNotificationRead(
  identity: MerchantNotificationIdentity,
  notificationId: string,
) {
  await assertActiveMerchantUser(identity);
  const notification = await prisma.merchantNotification.findFirst({
    where: dispatchNoticeScope(identity, notificationId),
    select: {
      id: true,
      shipment: {
        select: { id: true, restockRequest: { select: { id: true } } },
      },
    },
  });
  if (!notification) throw new Error('找不到這筆通知');
  await prisma.merchantNotificationRead.upsert({
    where: {
      notificationId_merchantUserId: {
        notificationId: notification.id,
        merchantUserId: identity.merchantUserId,
      },
    },
    create: {
      notificationId: notification.id,
      merchantUserId: identity.merchantUserId,
    },
    update: {},
  });
  return notification.shipment.restockRequest
    ? `/pos/restock/${notification.shipment.restockRequest.id}`
    : `/pos/shipments/${notification.shipment.id}`;
}
