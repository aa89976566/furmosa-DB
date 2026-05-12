import type { Shipment } from '@prisma/client';

export const SHIPMENT_STATUSES = ['pending', 'packed', 'shipped', 'delivered', 'cancelled'] as const;
export const SHIPMENT_TYPES = ['merchant_restock', 'customer_order', 'subscription'] as const;

export const shipmentStatusLabel: Record<string, string> = {
  pending: '待出貨',
  packed: '已包裝',
  shipped: '已寄出',
  delivered: '已送達',
  cancelled: '已取消',
};

export const shipmentStatusVariant: Record<
  string,
  'secondary' | 'warning' | 'info' | 'success' | 'destructive'
> = {
  pending: 'warning',
  packed: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'destructive',
};

export const shipmentTypeLabel: Record<string, string> = {
  merchant_restock: '寄賣進貨',
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
      return ['packed', 'cancelled'];
    case 'packed':
      return ['shipped', 'pending', 'cancelled'];
    case 'shipped':
      return ['delivered', 'packed'];
    default:
      return [];
  }
}

export function nextActionLabel(next: ShipmentStatus): string {
  switch (next) {
    case 'packed':
      return '標記為已包裝';
    case 'shipped':
      return '標記為已寄出';
    case 'delivered':
      return '標記為已送達';
    case 'pending':
      return '退回到待出貨';
    case 'cancelled':
      return '取消這張單';
    default:
      return next;
  }
}

export function timelineSteps(s: Pick<Shipment, 'status' | 'packedAt' | 'shippedAt' | 'deliveredAt' | 'cancelledAt' | 'createdAt'>) {
  return [
    { key: 'pending', label: '建立', at: s.createdAt, done: true },
    { key: 'packed', label: '已包裝', at: s.packedAt, done: !!s.packedAt },
    { key: 'shipped', label: '已寄出', at: s.shippedAt, done: !!s.shippedAt },
    {
      key: 'delivered',
      label: '已送達',
      at: s.deliveredAt,
      done: !!s.deliveredAt,
    },
  ];
}
