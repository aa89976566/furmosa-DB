import type { Prisma } from '@prisma/client';

type OrderSyncContext = {
  existingShippedAt?: Date | null;
  shipmentShippedAt?: Date | null;
};

/** 出貨單狀態 → 訂單更新（出貨隊列改狀態時） */
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
    case 'packed':
      return {
        fulfillmentStatus: 'pending',
        status: 'packed',
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

/** 訂單狀態 → fulfillmentStatus（訂單詳情改狀態時） */
export function fulfillmentStatusFromOrderStatus(status: string): string {
  switch (status) {
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'returned';
    default:
      return 'pending';
  }
}

/** 訂單狀態 → 關聯出貨單 status */
export function shipmentStatusFromOrderStatus(
  orderStatus: string,
): 'pending' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | null {
  switch (orderStatus) {
    case 'draft':
    case 'confirmed':
      return 'pending';
    case 'packed':
      return 'packed';
    case 'shipped':
      return 'shipped';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

export function buildShipmentUpdateFromOrderStatus(
  orderStatus: string,
  now = new Date(),
): Prisma.ShipmentUpdateManyMutationInput | null {
  const status = shipmentStatusFromOrderStatus(orderStatus);
  if (!status) return null;

  const data: Prisma.ShipmentUpdateManyMutationInput = { status };

  if (status === 'pending' || status === 'packed') {
    data.shippedAt = null;
    data.deliveredAt = null;
    data.cancelledAt = null;
  } else if (status === 'shipped') {
    data.shippedAt = now;
    data.deliveredAt = null;
    data.cancelledAt = null;
  } else if (status === 'delivered') {
    data.deliveredAt = now;
    data.cancelledAt = null;
  } else if (status === 'cancelled') {
    data.cancelledAt = now;
  }

  return data;
}
