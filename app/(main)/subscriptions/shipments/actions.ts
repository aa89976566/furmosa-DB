'use server';

import { prisma } from '@/lib/prisma';
import {
  buildLinkedShipmentUpdateFromSubscription,
  buildSubscriptionShipmentUpdate,
  refreshSubscriptionNextShipmentDate,
  SUBSCRIPTION_SHIPMENT_STATUSES,
  type SubscriptionShipmentStatus,
} from '@/lib/subscription-shipment-status';
import { revalidatePath } from 'next/cache';

export async function updateSubscriptionShipmentStatus(formData: FormData) {
  const subscriptionShipmentId = String(formData.get('subscriptionShipmentId') ?? '').trim();
  const next = String(formData.get('next') ?? '').trim();

  if (!subscriptionShipmentId) throw new Error('缺少出貨排程');
  if (!(SUBSCRIPTION_SHIPMENT_STATUSES as readonly string[]).includes(next)) {
    throw new Error('狀態錯誤');
  }

  const row = await prisma.subscriptionShipment.findUnique({
    where: { id: subscriptionShipmentId },
    include: {
      shipment: { select: { id: true, shippedAt: true } },
      subscription: { select: { id: true, status: true } },
    },
  });
  if (!row) throw new Error('出貨排程不存在');

  const now = new Date();
  const subUpdate = buildSubscriptionShipmentUpdate(next as SubscriptionShipmentStatus, now);

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionShipment.update({
      where: { id: subscriptionShipmentId },
      data: subUpdate,
    });

    if (row.shipment) {
      await tx.shipment.update({
        where: { id: row.shipment.id },
        data: buildLinkedShipmentUpdateFromSubscription(
          next as SubscriptionShipmentStatus,
          { shippedAt: row.shipment.shippedAt },
          now,
        ),
      });
    }

    if (row.subscription.status === 'active') {
      await refreshSubscriptionNextShipmentDate(tx, row.subscription.id);
    }
  });

  revalidatePath('/subscriptions/shipments');
  revalidatePath('/subscriptions');
  revalidatePath(`/subscriptions/${row.subscription.id}`);
  revalidatePath('/shipments');
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
}
