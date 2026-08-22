export type RefillPurchaseMode = 'exchange' | 'first';

export type RefillPreviewOrder = {
  orderId: string;
  appointmentTime: string;
  customerLabel: string;
  petLabel: string;
  productLabel: string;
  quantity: number;
  purchaseMode: RefillPurchaseMode;
  paid: boolean;
  reserved: boolean;
  arrived: boolean;
  paidAmountTwd: number;
  paymentMethod: 'LINE／綠界線上付款';
  expectedOldSerials: readonly string[];
};

export type RefillDeliveryStage =
  | 'verify'
  | 'confirm'
  | 'completed'
  | 'held_for_next_visit'
  | 'awaiting_top_up';

export type RefillPriceBreakdown = {
  exchangeQuantity: number;
  originalPriceQuantity: number;
  finalAmountTwd: number;
  prepaidAmountTwd: number;
  topUpAmountTwd: number;
};

export function refillPriceBreakdown(
  order: RefillPreviewOrder,
  verifiedOldJarCount: number,
  pickupQuantity = order.quantity,
): RefillPriceBreakdown {
  const quantity = Math.min(order.quantity, Math.max(1, pickupQuantity));
  const exchangeQuantity = order.purchaseMode === 'exchange'
    ? Math.min(quantity, Math.max(0, verifiedOldJarCount))
    : 0;
  const originalPriceQuantity = quantity - exchangeQuantity;
  const finalAmountTwd = exchangeQuantity * 99 + originalPriceQuantity * 129;
  const prepaidAmountTwd = order.purchaseMode === 'exchange'
    ? Math.min(order.paidAmountTwd, quantity * 99)
    : Math.min(order.paidAmountTwd, quantity * 129);

  return {
    exchangeQuantity,
    originalPriceQuantity,
    finalAmountTwd,
    prepaidAmountTwd,
    topUpAmountTwd: Math.max(0, finalAmountTwd - prepaidAmountTwd),
  };
}

export const REFILL_PREVIEW_ORDERS: readonly RefillPreviewOrder[] = [
  {
    orderId: 'REFILL-DEMO-001',
    appointmentTime: '13:30',
    customerLabel: '示意會員 A',
    petLabel: '豆豆',
    productLabel: '雞肉凍乾 袋裝 100g',
    quantity: 1,
    purchaseMode: 'exchange',
    paid: true,
    reserved: true,
    arrived: true,
    paidAmountTwd: 99,
    paymentMethod: 'LINE／綠界線上付款',
    expectedOldSerials: ['12345678'],
  },
  {
    orderId: 'REFILL-DEMO-003',
    appointmentTime: '14:00',
    customerLabel: '示意會員 B',
    petLabel: '球球',
    productLabel: '原味牛肉條 原味 150g',
    quantity: 2,
    purchaseMode: 'exchange',
    paid: true,
    reserved: true,
    arrived: false,
    paidAmountTwd: 198,
    paymentMethod: 'LINE／綠界線上付款',
    expectedOldSerials: ['87654321', '11223344'],
  },
  {
    orderId: 'REFILL-DEMO-004',
    appointmentTime: '17:00',
    customerLabel: '示意會員 C',
    petLabel: '咪咪',
    productLabel: '雞肉凍乾 袋裝 50g',
    quantity: 1,
    purchaseMode: 'first',
    paid: true,
    reserved: true,
    arrived: false,
    paidAmountTwd: 129,
    paymentMethod: 'LINE／綠界線上付款',
    expectedOldSerials: [],
  },
  {
    orderId: 'REFILL-DEMO-002',
    appointmentTime: '18:30',
    customerLabel: '示意會員 D',
    petLabel: '毛毛',
    productLabel: '原味牛肉條 原味 80g',
    quantity: 1,
    purchaseMode: 'exchange',
    paid: false,
    reserved: false,
    arrived: false,
    paidAmountTwd: 99,
    paymentMethod: 'LINE／綠界線上付款',
    expectedOldSerials: ['55667788'],
  },
] as const;

export function actionableRefillOrders(
  orders: readonly RefillPreviewOrder[],
): RefillPreviewOrder[] {
  return orders
    .filter((order) => order.paid && order.reserved)
    .sort((left, right) => {
      if (left.arrived !== right.arrived) return left.arrived ? -1 : 1;
      return left.appointmentTime.localeCompare(right.appointmentTime);
    });
}

export function blockedRefillOrders(
  orders: readonly RefillPreviewOrder[],
): RefillPreviewOrder[] {
  return orders.filter((order) => !order.paid || !order.reserved);
}

export function initialRefillStage(order: RefillPreviewOrder): RefillDeliveryStage {
  return order.purchaseMode === 'first' ? 'confirm' : 'verify';
}

export function canConfirmRefillDelivery(
  order: RefillPreviewOrder,
  verifiedSerials: readonly boolean[],
  topUpPaid = false,
  pickupQuantity = order.quantity,
): boolean {
  if (!order.paid || !order.reserved) return false;
  if (order.purchaseMode === 'first') return true;
  if (verifiedSerials.length !== pickupQuantity || order.expectedOldSerials.length < pickupQuantity) return false;
  const verifiedCount = verifiedSerials.filter(Boolean).length;
  const pricing = refillPriceBreakdown(order, verifiedCount, pickupQuantity);
  return pricing.topUpAmountTwd === 0 ? verifiedSerials.every(Boolean) : topUpPaid;
}

export function nextActionableRefillOrder(
  orders: readonly RefillPreviewOrder[],
  currentOrderId: string,
  completedOrderIds: ReadonlySet<string>,
): RefillPreviewOrder | null {
  return (
    actionableRefillOrders(orders).find(
      (order) => order.orderId !== currentOrderId && !completedOrderIds.has(order.orderId),
    ) ?? null
  );
}
