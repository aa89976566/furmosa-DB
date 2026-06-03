import type { Shipment } from '@prisma/client';

export const SHIPMENT_STATUSES = ['pending', 'packed', 'shipped', 'delivered', 'cancelled'] as const;
export const SHIPMENT_TYPES = ['merchant_restock', 'customer_order', 'subscription'] as const;

/** 尚未寄出（含舊資料 packed，視同待出貨） */
export const PRE_SHIP_STATUSES = ['pending', 'packed'] as const;

export function isPreShipStatus(status: string) {
  return status === 'pending' || status === 'packed';
}

export const shipmentStatusLabel: Record<string, string> = {
  pending: '待出貨',
  packed: '待出貨',
  shipped: '已寄出',
  delivered: '已送達',
  cancelled: '已取消',
};

export const shipmentStatusVariant: Record<
  string,
  'secondary' | 'warning' | 'info' | 'success' | 'destructive'
> = {
  pending: 'warning',
  packed: 'warning',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'destructive',
};

export const shipmentTypeLabel: Record<string, string> = {
  merchant_restock: '寄賣',
  customer_order: '客戶訂單',
  subscription: '訂閱出貨',
};

export const shipmentTypeIcon: Record<string, string> = {
  merchant_restock: 'store',
  customer_order: 'user',
  subscription: 'repeat',
};

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export function nextStatuses(current: string): ShipmentStatus[] {
  switch (current) {
    case 'pending':
    case 'packed':
      return ['shipped', 'cancelled'];
    case 'shipped':
      return ['delivered', 'pending'];
    default:
      return [];
  }
}

export function nextActionLabel(next: ShipmentStatus): string {
  switch (next) {
    case 'shipped':
      return '標記為已寄出';
    case 'delivered':
      return '貨物到達';
    case 'pending':
      return '退回到待出貨';
    case 'cancelled':
      return '取消這張單';
    default:
      return next;
  }
}

export function timelineSteps(
  s: Pick<Shipment, 'status' | 'shippedAt' | 'deliveredAt' | 'cancelledAt' | 'createdAt'>,
) {
  return [
    { key: 'pending', label: '建立', at: s.createdAt, done: true },
    { key: 'shipped', label: '已寄出', at: s.shippedAt, done: !!s.shippedAt },
    {
      key: 'delivered',
      label: '已送達',
      at: s.deliveredAt,
      done: !!s.deliveredAt,
    },
  ];
}

const cvsBrandLabel: Record<string, string> = {
  '711': '7-ELEVEN',
  familymart: '全家',
  hilife: '萊爾富',
};

type DeliverySummaryShipment = {
  recipientAddress?: string | null;
};

type DeliverySummaryOrder = {
  shippingMethod?: string;
  shippingAddress?: string | null;
  cvsBrand?: string | null;
  cvsStoreId?: string | null;
  cvsStoreName?: string | null;
} | null;

export function formatShipmentDeliverySummary(
  shipment: DeliverySummaryShipment,
  order?: DeliverySummaryOrder,
) {
  if (order?.shippingMethod === 'convenience') {
    const brand = order.cvsBrand ? (cvsBrandLabel[order.cvsBrand] ?? order.cvsBrand) : '超商取貨';
    const store = order.cvsStoreName?.trim() || order.shippingAddress?.trim() || '';
    return store ? `${brand} · ${store}` : brand;
  }
  const addr = shipment.recipientAddress?.trim();
  if (addr?.startsWith('7-11') || addr?.startsWith('7-ELEVEN')) return addr;
  return addr || '宅配';
}
