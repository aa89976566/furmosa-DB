import type { Prisma } from '@prisma/client';

type OrderSyncContext = {
  existingShippedAt?: Date | null;
  shipmentShippedAt?: Date | null;
};

export function buildOrderUpdateFromShipmentStatus(
  next: string,
  ctx: OrderSyncContext = {},
): Prisma.OrderUpdateInput | null {
  const now = new Date();

  switch (next) {
    case 'pending':
      return {
        fulfillmentStatus: 'pending',
        status: 'confirmed',
        shippedAt: null,
        completedAt: null,
      };
    case 'shipped':
      return {
        fulfillmentStatus: 'shipped',
        status: 'shipped',
        shippedAt: now,
        completedAt: null,
      };
    case 'delivered':
      return {
        fulfillmentStatus: 'delivered',
        status: 'delivered',
        shippedAt: ctx.existingShippedAt ?? ctx.shipmentShippedAt ?? now,
        completedAt: now,
      };
    case 'cancelled':
      return {
        fulfillmentStatus: 'returned',
        status: 'cancelled',
        completedAt: null,
      };
    default:
      return null;
  }
}
