import type { Prisma } from '@prisma/client';

/** 訂單列表：依 Order.source 分類 */
export const ORDER_SOURCE_TABS = [
  { key: '', label: '全部' },
  { key: 'shopify', label: 'Shopify' },
  { key: 'website', label: '官網' },
  { key: 'line', label: 'LINE' },
  { key: 'consignment', label: '寄賣' },
  { key: 'wholesale', label: '買斷' },
  { key: 'manual', label: '手動' },
] as const;

export const ORDER_SOURCE_KEYS = ['shopify', 'website', 'line', 'consignment', 'wholesale', 'manual'] as const;

/** 出貨隊列種類（consignment key 為相容舊網址，畫面顯示店家補貨）。 */
export const SHIPMENT_KIND_TABS = [
  { key: '', label: '全部' },
  { key: 'customer_order', label: '直客訂單', hint: 'Shopify / 官網 / LINE / 手動，不含寄賣店成交' },
  { key: 'subscription', label: '訂閱', hint: '訂閱制定期出貨' },
  { key: 'consignment', label: '店家補貨', hint: '寄賣、買斷與換罐計畫的店家補貨' },
  { key: 'merchant_consignment', label: '寄賣', hint: '店家寄賣補貨' },
  { key: 'merchant_wholesale', label: '進貨', hint: '店家買斷進貨' },
  { key: 'merchant_jar_exchange', label: '換罐計畫', hint: '店家換罐計畫補貨' },
  { key: 'merchant_unclassified', label: '模式未設定', hint: '尚未記錄合作模式的店家補貨' },
] as const;

export const SHIPMENT_KIND_KEYS = [
  'customer_order',
  'subscription',
  'consignment',
  'merchant_consignment',
  'merchant_wholesale',
  'merchant_jar_exchange',
  'merchant_unclassified',
] as const;

export type ShipmentKindKey = (typeof SHIPMENT_KIND_KEYS)[number];

export type ShipmentDisplayKind =
  | 'customer_order'
  | 'subscription'
  | 'merchant_consignment'
  | 'merchant_wholesale'
  | 'merchant_jar_exchange'
  | 'merchant_unclassified';

export const shipmentDisplayKindLabel: Record<ShipmentDisplayKind, string> = {
  customer_order: '客戶訂單',
  subscription: '訂閱出貨',
  merchant_consignment: '寄賣',
  merchant_wholesale: '進貨',
  merchant_jar_exchange: '換罐計畫',
  merchant_unclassified: '模式未設定',
};

export function resolveShipmentDisplayKind(input: {
  type: string;
  merchantOrderMode?: string | null;
}): ShipmentDisplayKind {
  if (input.type === 'subscription') return 'subscription';
  if (input.type !== 'merchant_restock') return 'customer_order';

  if (input.merchantOrderMode === 'consignment') return 'merchant_consignment';
  if (input.merchantOrderMode === 'wholesale') return 'merchant_wholesale';
  if (input.merchantOrderMode === 'jar_exchange') return 'merchant_jar_exchange';
  return 'merchant_unclassified';
}

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
  if (kind === 'subscription') return { type: 'subscription' };
  if (kind === 'merchant_consignment') {
    return { type: 'merchant_restock', order: { merchantOrderMode: 'consignment' } };
  }
  if (kind === 'merchant_wholesale') {
    return { type: 'merchant_restock', order: { merchantOrderMode: 'wholesale' } };
  }
  if (kind === 'merchant_jar_exchange') {
    return { type: 'merchant_restock', order: { merchantOrderMode: 'jar_exchange' } };
  }
  return {
    type: 'merchant_restock',
    OR: [
      { orderId: null },
      { order: { merchantOrderMode: null } },
      {
        order: {
          merchantOrderMode: { notIn: ['consignment', 'wholesale', 'jar_exchange'] },
        },
      },
    ],
  };
}

export function mergeShipmentWhere(
  base: Prisma.ShipmentWhereInput,
  kind?: string,
): Prisma.ShipmentWhereInput {
  if (!kind || !isShipmentKindKey(kind)) return base;
  return { AND: [base, shipmentWhereForKind(kind)] };
}
