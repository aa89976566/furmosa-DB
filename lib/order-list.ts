import type { Prisma } from '@prisma/client';

/** 訂單列表／歷史訂單共用查詢條件 */

export const ORDER_LIST_INCLUDE = {
  customer: true,
  merchant: {
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      address: true,
      city: true,
      preferredCarrier: true,
      pickupStoreName: true,
    },
  },
  _count: { select: { items: true } },
  items: {
    orderBy: { id: 'asc' as const },
    take: 2,
    select: {
      id: true,
      productName: true,
      quantity: true,
      isGift: true,
    },
  },
  shipments: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      shipmentNumber: true,
      status: true,
      type: true,
      carrier: true,
      trackingNumber: true,
      recipientName: true,
      recipientPhone: true,
      recipientAddress: true,
    },
  },
} as const;

/** 已封存、已退貨或已取消 → 歷史訂單 */
export function isHistoricalOrder(order: {
  status: string;
  fulfillmentStatus: string;
  archivedAt?: Date | null;
}) {
  return Boolean(order.archivedAt) || order.fulfillmentStatus === 'returned' || order.status === 'cancelled';
}

export const historicalOrderWhere = {
  deletedAt: null,
  OR: [
    { archivedAt: { not: null } },
    { fulfillmentStatus: 'returned' as const },
    { status: 'cancelled' as const },
  ],
};

export const activeOrderWhere = {
  deletedAt: null,
  archivedAt: null,
  fulfillmentStatus: { not: 'returned' as const },
  status: { not: 'cancelled' as const },
};

const legacyReadyOrderStatuses = ['confirmed', 'packed'];
const legacyReadyFulfillmentStatuses = ['pending', 'packed'];
const completedShipmentStatuses = ['delivered', 'received'];
const cancelledShipmentStatus = 'cancelled';

export const legacyReadyOrderWhere = {
  omsStatus: null,
  status: { in: legacyReadyOrderStatuses },
  fulfillmentStatus: { in: legacyReadyFulfillmentStatuses },
} satisfies Prisma.OrderWhereInput;

export const completedOrderShipmentsWhere = {
  shipments: {
    some: { status: { in: completedShipmentStatuses } },
    every: { status: { in: [...completedShipmentStatuses, cancelledShipmentStatus] } },
  },
} satisfies Prisma.OrderWhereInput;

/** Display the receipt outcome for legacy orders whose original fields still show pending. */
export function legacyOrderCompletedByShipments(order: {
  omsStatus: string | null;
  status: string;
  fulfillmentStatus: string;
  shipments: readonly { status: string }[];
}) {
  if (order.omsStatus !== null || !legacyReadyOrderStatuses.includes(order.status)
    || !legacyReadyFulfillmentStatuses.includes(order.fulfillmentStatus)) return false;
  const active = order.shipments.filter(shipment => shipment.status !== cancelledShipmentStatus);
  return active.length > 0 && active.every(shipment => completedShipmentStatuses.includes(shipment.status));
}
