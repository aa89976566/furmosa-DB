import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** 訂單列表：依 Order.source 分類 */
export const ORDER_SOURCE_TABS = [
  { key: '', label: '全部' },
  { key: 'website', label: '官網' },
  { key: 'line', label: 'LINE' },
  { key: 'consignment', label: '寄賣' },
  { key: 'manual', label: '手動' },
] as const;

export const ORDER_SOURCE_KEYS = ['website', 'line', 'consignment', 'manual'] as const;

/** 出貨隊列種類（consignment 為邏輯分類，含進貨與寄賣成交） */
export const SHIPMENT_KIND_TABS = [
  { key: '', label: '全部' },
  { key: 'customer_order', label: '客戶訂單' },
  { key: 'subscription', label: '訂閱' },
  { key: 'consignment', label: '寄賣' },
] as const;

export const SHIPMENT_KIND_KEYS = ['customer_order', 'subscription', 'consignment'] as const;

export type ShipmentKindKey = (typeof SHIPMENT_KIND_KEYS)[number];

export function isShipmentKindKey(value: string): value is ShipmentKindKey {
  return (SHIPMENT_KIND_KEYS as readonly string[]).includes(value);
}

/** 出貨隊列「寄賣」= 店家進貨 + 寄賣成交訂單 */
export const consignmentShipmentWhere: Prisma.ShipmentWhereInput = {
  OR: [
    { type: 'merchant_restock' },
    { type: 'customer_order', order: { source: 'consignment' } },
  ],
};

/** 出貨隊列「客戶訂單」= 非寄賣來源的 customer_order */
export const retailCustomerShipmentWhere: Prisma.ShipmentWhereInput = {
  type: 'customer_order',
  OR: [{ orderId: null }, { order: { source: { not: 'consignment' } } }],
};

export function shipmentWhereForKind(kind: ShipmentKindKey): Prisma.ShipmentWhereInput {
  if (kind === 'consignment') return consignmentShipmentWhere;
  if (kind === 'customer_order') return retailCustomerShipmentWhere;
  return { type: 'subscription' };
}

export function mergeShipmentWhere(
  base: Prisma.ShipmentWhereInput,
  kind?: string,
): Prisma.ShipmentWhereInput {
  if (!kind || !isShipmentKindKey(kind)) return base;
  return { AND: [base, shipmentWhereForKind(kind)] };
}

const historyStatuses: Prisma.ShipmentWhereInput = {
  status: { in: ['shipped', 'delivered'] },
};

/** 出貨歷史依種類篩選（與出貨隊列一致） */
export function historyShipmentWhere(rawType?: string): Prisma.ShipmentWhereInput {
  const type =
    rawType === 'restock' || rawType === 'merchant_restock' ? 'consignment' : rawType;
  if (type === 'subscription') {
    return { ...historyStatuses, type: 'subscription' };
  }
  if (type === 'consignment' && isShipmentKindKey('consignment')) {
    return { AND: [historyStatuses, consignmentShipmentWhere] };
  }
  if (type === 'customer_order' || type === 'order') {
    return { AND: [historyStatuses, retailCustomerShipmentWhere] };
  }
  return historyStatuses;
}

export async function countHistoryShipments(kind?: ShipmentKindKey): Promise<number> {
  const where =
    kind === 'consignment'
      ? { AND: [historyStatuses, consignmentShipmentWhere] }
      : kind === 'customer_order'
        ? { AND: [historyStatuses, retailCustomerShipmentWhere] }
        : kind === 'subscription'
          ? { ...historyStatuses, type: 'subscription' as const }
          : historyStatuses;
  return prisma.shipment.count({ where });
}
