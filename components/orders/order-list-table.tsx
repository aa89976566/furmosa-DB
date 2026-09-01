'use client';

import Link from 'next/link';
import { ChevronRight, PackageCheck, Truck } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { omsNextActionLabel } from '@/lib/orders/oms';
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
  const destination = logistics.destination !== '—' ? ` · ${logistics.destination}` : '';

  return <article className={styles.row}>
    <div className={styles.identity}>
      <StatusBadge kind="orderSource" value={order.source} />
      {order.customer
        ? <Link href={`/customers/${order.customer.id}`} className={styles.customer}>{customer}</Link>
        : <span className={styles.customer}>{customer}</span>}
    </div>

    <div className={styles.action}>
      <PackageCheck className={styles.actionIcon} aria-hidden />
      <div className={styles.actionCopy}>
        <p className={styles.actionLabel}>{action.label}</p>
        <p className={styles.actionHint}>{action.hint}</p>
      </div>
    </div>

    <div className={styles.meta}>
      <span className={styles.product}>{item}</span>
      <span className={styles.delivery}><Truck aria-hidden />{logistics.carrierLabel}{destination}</span>
      <Link href={`/orders/${order.id}`} className={styles.reference}>{order.externalOrderName || order.orderNumber} · {formatDateTime(order.orderedAt)}</Link>
    </div>

    <div className={styles.money}>
      <p>{formatCurrency(Number(order.total))}</p>
      <StatusBadge kind="payment" value={order.paymentStatus} />
    </div>

    <Link href={`/orders/${order.id}`} className={action.active ? styles.primaryAction : styles.secondaryAction} aria-label={`${action.label}：${customer}`}>
      <span>{action.active ? '開始處理' : '查看'}</span><ChevronRight aria-hidden />
    </Link>
  </article>;
}
