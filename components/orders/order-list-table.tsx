'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { omsNextActionLabel, parseOmsIssues, type OmsIssueCode } from '@/lib/orders/oms';
import styles from './order-resource-list.module.css';

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

function orderCustomer(order: OrderListRow) {
  const snapshot = snapshotView(order.shopifySnapshot);
  return order.customer?.name ?? snapshot?.recipient ?? order.merchant?.name ?? '收件人待確認';
}

function orderItemSummary(order: OrderListRow) {
  const sourceItems = snapshotView(order.shopifySnapshot)?.items ?? [];
  const rows = sourceItems.length
    ? sourceItems.map((item) => ({ name: item.title, quantity: item.quantity }))
    : order.items.map((item) => ({ name: item.productName, quantity: item.quantity }));
  if (!rows.length) return '商品待確認';
  const first = rows[0]!;
  const firstLabel = `${first.name}${first.quantity ? ` × ${first.quantity}` : ''}`;
  const total = sourceItems.length || order._count.items;
  return total > 1 ? `${firstLabel} · 共 ${total} 項` : firstLabel;
}

function nextAction(order: OrderListRow) {
  if (order.omsStatus) {
    if (order.omsStatus === 'NEW' || order.omsStatus === 'REVIEW') {
      const waiting = !['paid', 'cod'].includes(order.paymentStatus);
      return { label: waiting ? '等待付款' : omsNextActionLabel(order.omsStatus, order.omsIssueFlags), hint: waiting ? '付款後繼續' : '現在處理', active: !waiting };
    }
    if (order.omsStatus === 'READY') return { label: '建立物流單', hint: '已通過審核', active: true };
    if (order.omsStatus === 'FULFILLMENT_PENDING') return { label: '等待交寄', hint: '物流單已建立', active: false };
    return { label: '已完成', hint: '已出貨', active: false };
  }
  if (order.status === 'cancelled') return { label: '已取消', hint: '無需處理', active: false };
  if (order.fulfillmentStatus === 'delivered' || order.status === 'completed') return { label: '已完成', hint: '交易完成', active: false };
  if (order.fulfillmentStatus === 'shipped') return { label: '運送中', hint: '等待送達', active: false };
  if (order.paymentStatus !== 'paid') return { label: '等待付款', hint: '尚未付款', active: false };
  if (order.status === 'pending_review' || order.status === 'draft') return { label: '確認訂單內容', hint: '現在處理', active: true };
  return { label: '等待交寄', hint: '查看出貨進度', active: false };
}

const ISSUE_CATEGORY: Record<OmsIssueCode, string> = {
  PAYMENT_PENDING: '待付款', PAYMENT_REFUNDED: '退款確認', ORDER_CANCELLED: '訂單取消',
  SKU_MISSING: '缺少 SKU', PRODUCT_UNMAPPED: '商品未對應', STOCK_UNKNOWN: '庫存待確認',
  STOCK_INSUFFICIENT: '庫存不足', SHIPPING_METHOD_UNKNOWN: '配送待確認',
  PICKUP_STORE_MISSING: '缺門市資料', TEMPERATURE_UNKNOWN: '溫層待確認',
  TEMPERATURE_CONFLICT: '溫層衝突', GIFT_REVIEW_REQUIRED: '贈品待確認',
  RECIPIENT_MISSING: '缺收件人', PHONE_MISSING: '缺電話', ADDRESS_MISSING: '缺地址',
  POSSIBLE_DUPLICATE: '疑似重複', SOURCE_VERSION_UNKNOWN: '同步異常', ORDER_CHANGED: '內容待檢查',
};

function issueCategory(order: OrderListRow) {
  const issues = parseOmsIssues(order.omsIssueFlags);
  if (!issues) return { label: '待檢查', tone: 'warning' as const };
  const issue = issues.find((item) => item.severity === 'blocking' && item.code !== 'PAYMENT_PENDING')
    ?? issues.find((item) => item.severity === 'blocking')
    ?? issues[0];
  if (!issue) return { label: '資料完整', tone: 'ok' as const };
  return { label: ISSUE_CATEGORY[issue.code], tone: issue.severity === 'blocking' ? 'blocking' as const : 'warning' as const };
}

export function OrderListTable({ orders }: { orders: OrderListRow[] }) {
  if (orders.length === 0) {
    return <section className={styles.empty}>目前沒有需要處理的訂單</section>;
  }

  return <section className={styles.list} aria-label="訂單列表">
    {orders.map((order) => <OrderResourceRow key={order.id} order={order} />)}
  </section>;
}

function OrderResourceRow({ order }: { order: OrderListRow }) {
  const customer = orderCustomer(order);
  const item = orderItemSummary(order);
  const logistics = resolveLogisticsForOrderList(order);
  const action = nextAction(order);
  const issue = issueCategory(order);
  const orderReference = order.externalOrderName || order.orderNumber;

  return <article className={styles.row}>
    <div className={styles.identity}>
      <Link href={`/orders/${order.id}`} className={styles.orderNumber}>{orderReference}</Link>
      <div className={styles.tags}>
        <StatusBadge kind="orderSource" value={order.source} />
        <span className={`${styles.issueTag} ${styles[issue.tone]}`}>{issue.label}</span>
      </div>
    </div>

    <div className={styles.summary}>
      {order.customer
        ? <Link href={`/customers/${order.customer.id}`} className={styles.customer}>{customer}</Link>
        : <span className={styles.customer}>{customer}</span>}
      <span aria-hidden>·</span>
      <span className={styles.product}>{item}</span>
      <span className={styles.delivery}>{logistics.carrierLabel}</span>
    </div>

    <div className={styles.money}>
      <p>{formatCurrency(Number(order.total))}</p>
      <StatusBadge kind="payment" value={order.paymentStatus} />
    </div>

    <Link href={`/orders/${order.id}`} className={action.active ? styles.primaryAction : styles.secondaryAction} aria-label={`${action.label}：${customer}`}>
      <span>{action.active ? action.label : '查看'}</span><ChevronRight aria-hidden />
    </Link>
  </article>;
}
