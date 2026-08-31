import type { Prisma } from '@prisma/client';

/** 訂單列表：依 Order.source 分類 */
export const ORDER_SOURCE_TABS = [
  { key: '', label: '全部' },
  { key: 'shopify', label: 'Shopify' },
  { key: 'website', label: '官網' },
  { key: 'line', label: 'LINE' },
  { key: 'consignment', label: '寄賣' },
  { key: 'wholesale', label: '販售' },
  { key: 'manual', label: '手動' },
] as const;

export const ORDER_SOURCE_KEYS = ['shopify', 'website', 'line', 'consignment', 'wholesale', 'manual'] as const;

/** 出貨隊列種類（consignment key 為相容舊網址，畫面顯示店家補貨）。 */
export const SHIPMENT_KIND_TABS = [
  { key: '', label: '全部' },
  { key: 'customer_order', label: '直客訂單', hint: 'Shopify / 官網 / LINE / 手動，不含寄賣店成交' },
  { key: 'subscription', label: '訂閱', hint: '訂閱制定期出貨' },
  { key: 'consignment', label: '店家補貨', hint: '寄賣、販售與換罐計畫的店家補貨' },
] as const;

export const SHIPMENT_KIND_KEYS = ['customer_order', 'subscription', 'consignment'] as const;

export type ShipmentKindKey = (typeof SHIPMENT_KIND_KEYS)[number];

export function isShipmentKindKey(value: string): value is ShipmentKindKey {
  return (SHIPMENT_KIND_KEYS as readonly string[]).includes(value);
}

/** 出貨隊列「店家補貨」= 店家進貨 + 寄賣成交訂單。 */
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
