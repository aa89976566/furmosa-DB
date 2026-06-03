import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export const SUBSCRIPTION_SHIPMENT_STATUSES = [
  'pending',
  'packed',
  'shipped',
  'delivered',
  'skipped',
] as const;

export type SubscriptionShipmentStatus = (typeof SUBSCRIPTION_SHIPMENT_STATUSES)[number];

export const PENDING_SUBSCRIPTION_SHIPMENT_STATUSES = ['pending', 'packed'] as const;

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** 訂閱排程狀態 → 物流 Shipment 狀態 */
export function shipmentStatusFromSubscriptionStatus(
  status: string,
): 'pending' | 'packed' | 'shipped' | 'delivered' | 'cancelled' {
  if (status === 'skipped') return 'cancelled';
  if (status === 'delivered') return 'delivered';
  if (status === 'shipped') return 'shipped';
  if (status === 'packed') return 'packed';
  return 'pending';
}

export function buildSubscriptionShipmentUpdate(
  next: SubscriptionShipmentStatus,
  now = new Date(),
): Prisma.SubscriptionShipmentUpdateInput {
  const data: Prisma.SubscriptionShipmentUpdateInput = { status: next };

  if (next === 'pending' || next === 'skipped') {
    data.packedAt = null;
    data.shippedAt = null;
    data.deliveredAt = null;
  } else if (next === 'packed') {
    data.packedAt = now;
    data.shippedAt = null;
    data.deliveredAt = null;
  } else if (next === 'shipped') {
    data.shippedAt = now;
    data.deliveredAt = null;
  } else if (next === 'delivered') {
    data.deliveredAt = now;
  }

  return data;
}

export function buildLinkedShipmentUpdateFromSubscription(
  next: SubscriptionShipmentStatus,
  existing: { shippedAt?: Date | null },
  now = new Date(),
): Prisma.ShipmentUpdateInput {
  const status = shipmentStatusFromSubscriptionStatus(next);
  const data: Prisma.ShipmentUpdateInput = { status };

  if (status === 'pending' || status === 'packed' || status === 'cancelled') {
    data.shippedAt = null;
    data.deliveredAt = null;
    data.cancelledAt = status === 'cancelled' ? now : null;
  } else if (status === 'shipped') {
    data.shippedAt = now;
    data.deliveredAt = null;
    data.cancelledAt = null;
  } else if (status === 'delivered') {
    data.shippedAt = existing.shippedAt ?? now;
    data.deliveredAt = now;
    data.cancelledAt = null;
  }

  return data;
}

/** 依最早待出貨排程更新合約的「下次出貨」 */
export async function refreshSubscriptionNextShipmentDate(
  tx: Tx,
  subscriptionId: string,
): Promise<void> {
  const nextPending = await tx.subscriptionShipment.findFirst({
    where: {
      subscriptionId,
      status: { in: [...PENDING_SUBSCRIPTION_SHIPMENT_STATUSES] },
    },
    orderBy: { scheduledDate: 'asc' },
    select: { scheduledDate: true },
  });

  await tx.subscription.update({
    where: { id: subscriptionId },
    data: { nextShipmentDate: nextPending?.scheduledDate ?? null },
  });
}
