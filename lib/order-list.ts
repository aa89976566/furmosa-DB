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
    take: 1,
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

/** 已退貨或已取消 → 歷史訂單 */
export function isHistoricalOrder(order: {
  status: string;
  fulfillmentStatus: string;
}) {
  return order.fulfillmentStatus === 'returned' || order.status === 'cancelled';
}

export const historicalOrderWhere = {
  deletedAt: null,
  OR: [{ fulfillmentStatus: 'returned' as const }, { status: 'cancelled' as const }],
};

export const activeOrderWhere = {
  deletedAt: null,
  fulfillmentStatus: { not: 'returned' as const },
  status: { not: 'cancelled' as const },
};
