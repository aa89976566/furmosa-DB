import {
  REFILL_ACTIVE_STATUSES,
  type RefillOrderStatus,
} from '@/lib/refill/constants';

/** HQ 會員總檔：未完成換罐（沿用後端 ACTIVE，不含 completed／cancelled） */
export const CUSTOMER_OPEN_REFILL_STATUSES: readonly RefillOrderStatus[] =
  REFILL_ACTIVE_STATUSES;

export function isOpenRefillStatus(status: string): boolean {
  return (CUSTOMER_OPEN_REFILL_STATUSES as readonly string[]).includes(status);
}

export function refillOrderStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'payment_pending':
      return '待付款';
    case 'paid_waiting_return':
      return '已付款 待驗舊罐';
    case 'old_container_verified':
      return '舊罐已驗收 待交付';
    case 'awaiting_extra_payment':
      return '待補款 NT$30';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已取消';
    case 'expired':
      return '已過期';
    case 'payment_failed':
      return '付款失敗';
    default:
      return status;
  }
}

export function refillOrderTypeLabel(orderType: string): string {
  switch (orderType) {
    case 'first':
      return '首罐';
    case 'exchange':
      return '換罐';
    default:
      return orderType;
  }
}

export function paymentPurposeLabel(purpose: string): string {
  switch (purpose) {
    case 'refill':
      return '換罐／首罐款';
    case 'extra_topup':
      return '補差額 NT$30';
    default:
      return purpose;
  }
}

export function paymentOrderStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '待付款';
    case 'paid':
      return '已付款';
    case 'failed':
      return '付款失敗';
    default:
      return status;
  }
}

/** 純函式：只保留 issued 且綁定會員的持有罐（供測試） */
export function filterIssuedJarsForCustomer<
  T extends { status: string; redeemedByCustomerId: string | null },
>(rows: T[], customerId: string): T[] {
  return rows.filter(
    (row) => row.status === 'issued' && row.redeemedByCustomerId === customerId,
  );
}
