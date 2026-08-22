/** 換罐計畫價格與狀態（後端唯一真相；前端不可覆寫） */

export const REFILL_PRICES = {
  first: 129,
  exchange: 99,
  extraTopup: 30,
} as const;

export const REFILL_ORDER_TYPES = ['first', 'exchange'] as const;
export type RefillOrderType = (typeof REFILL_ORDER_TYPES)[number];

export const REFILL_DELIVERY_MODES = ['exchange', 'first'] as const;
export type RefillDeliveryMode = (typeof REFILL_DELIVERY_MODES)[number];

export const REFILL_ORDER_STATUSES = [
  'draft',
  'payment_pending',
  'paid_waiting_return',
  'old_container_verified',
  'completed',
  'payment_failed',
  'cancelled',
  'expired',
  'awaiting_extra_payment',
] as const;
export type RefillOrderStatus = (typeof REFILL_ORDER_STATUSES)[number];

/** 仍視為「有效未完成」— 同預約不可再建單 */
export const REFILL_ACTIVE_STATUSES: RefillOrderStatus[] = [
  'draft',
  'payment_pending',
  'paid_waiting_return',
  'old_container_verified',
  'awaiting_extra_payment',
];

/** 已付款、等待到店處理 */
export const REFILL_PAID_OPEN_STATUSES: RefillOrderStatus[] = [
  'paid_waiting_return',
  'old_container_verified',
  'awaiting_extra_payment',
];

export const PAYMENT_PURPOSES = ['refill', 'extra_topup', 'fulfillment_topup'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_ORDER_STATUSES = ['pending', 'paid', 'failed'] as const;
export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export const PAYMENT_PROVIDER_ECPAY = 'ecpay';

export function amountsForOrderType(orderType: RefillOrderType): {
  baseAmount: number;
  extraAmount: number;
  totalAmount: number;
} {
  if (orderType === 'first') {
    return {
      baseAmount: REFILL_PRICES.first,
      extraAmount: 0,
      totalAmount: REFILL_PRICES.first,
    };
  }
  return {
    baseAmount: REFILL_PRICES.exchange,
    extraAmount: 0,
    totalAmount: REFILL_PRICES.exchange,
  };
}

export function amountsAfterExtraTopup(baseExchange: number = REFILL_PRICES.exchange): {
  baseAmount: number;
  extraAmount: number;
  totalAmount: number;
} {
  const base = baseExchange > 0 ? baseExchange : REFILL_PRICES.exchange;
  return {
    baseAmount: base,
    extraAmount: REFILL_PRICES.extraTopup,
    totalAmount: base + REFILL_PRICES.extraTopup,
  };
}
