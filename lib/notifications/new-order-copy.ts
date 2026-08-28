import { formatCurrency } from '@/lib/format';
import { orderSourceLabel } from '@/lib/labels';

export type NewOrderNotifyInput = {
  id: string;
  orderNumber: string;
  total: number;
  source: string;
  needsReview?: boolean;
};

export function newOrderNeedsReview(source: string, needsReview?: boolean) {
  return needsReview ?? source === 'shopify';
}

export function newOrderNotifyCopy(order: NewOrderNotifyInput) {
  const source = orderSourceLabel[order.source] ?? order.source;
  const needsReview = newOrderNeedsReview(order.source, order.needsReview);
  return {
    title: needsReview ? `待審核訂單 ${order.orderNumber}` : `新訂單 ${order.orderNumber}`,
    body: `${source} · ${formatCurrency(order.total)}${needsReview ? ' · 請確認後出貨' : ''}`,
    url: `/orders/${order.id}`,
  };
}
