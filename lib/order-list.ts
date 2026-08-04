/** 訂單列表／歷史訂單共用查詢條件 */

export const ORDER_LIST_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
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
  items: {
    orderBy: { id: 'asc' as const },
    take: 3,
    select: {
      id: true,
      productName: true,
      quantity: true,
      isGift: true,
    },
  },
  _count: { select: { items: true } },
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

/** 列表「對象」：顧客 → 店家 → 出貨收件人 */
export function orderListCounterparty(order: {
  customer?: { name: string } | null;
  merchant?: { name: string } | null;
  shipments?: { recipientName: string | null }[];
}): string {
  const recipient = order.shipments?.[0]?.recipientName?.trim();
  return order.customer?.name ?? order.merchant?.name ?? recipient ?? '未指定對象';
}

/** 列表商品摘要：前幾項名稱 × 數量，其餘以「等 N 項」收斂 */
export function orderListProductSummary(order: {
  items: { productName: string; quantity: number; isGift: boolean }[];
  _count: { items: number };
}): string {
  if (order._count.items === 0) return '無商品';
  const parts = order.items.map((it) => {
    const gift = it.isGift ? '（贈）' : '';
    return `${it.productName}${gift} ×${it.quantity}`;
  });
  const shown = parts.join('、');
  const rest = order._count.items - order.items.length;
  return rest > 0 ? `${shown} 等 ${order._count.items} 項` : shown;
}

/** 已退貨或已取消 → 歷史訂單 */
export function isHistoricalOrder(order: {
  status: string;
  fulfillmentStatus: string;
}) {
  return order.fulfillmentStatus === 'returned' || order.status === 'cancelled';
}

export const historicalOrderWhere = {
  OR: [{ fulfillmentStatus: 'returned' as const }, { status: 'cancelled' as const }],
};

export const activeOrderWhere = {
  fulfillmentStatus: { not: 'returned' as const },
  status: { not: 'cancelled' as const },
};
