export const orderDeletionReasons = [
  '測試訂單',
  '客人取消',
  '重複訂單',
  '資料錯誤',
  '其他',
] as const;

export type OrderDeletionReason = (typeof orderDeletionReasons)[number];

export function isOrderDeletionReason(value: string): value is OrderDeletionReason {
  return orderDeletionReasons.includes(value as OrderDeletionReason);
}

export function deletionBlocker(order: {
  source: string; omsStatus: string | null; paymentStatus: string; status: string;
  fulfillmentStatus: string; shippedAt: Date | null; completedAt: Date | null;
  merchantId: string | null; subscriptionId: string | null;
}, related: boolean) {
  if (order.source !== 'shopify' || !order.omsStatus) return '目前僅開放 Shopify OMS 訂單刪除；舊流程訂單需另外核對';
  if (!['NEW', 'REVIEW', 'READY'].includes(order.omsStatus)) return '訂單已進入履約流程，不能刪除';
  if (order.paymentStatus !== 'unpaid') return '已有付款、退款或其他帳務狀態，不能直接刪除';
  if (!['draft', 'pending_review', 'cancelled'].includes(order.status)
    || order.fulfillmentStatus !== 'pending' || order.shippedAt || order.completedAt
    || order.merchantId || order.subscriptionId || related) return '已有出貨、帳務或其他關聯紀錄，不能直接刪除';
  return null;
}
