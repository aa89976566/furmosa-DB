'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { LogisticsSummary } from '@/components/shared/logistics-summary';
import { VirtualCardList } from '@/components/shared/virtualized-rows';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import type { Prisma } from '@prisma/client';
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { ChevronRight } from 'lucide-react';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { omsNextActionLabel } from '@/lib/orders/oms';

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

function orderCustomer(order: OrderListRow) {
  const snapshot = snapshotView(order.shopifySnapshot);
  return {
    name: order.customer?.name ?? snapshot?.recipient ?? order.merchant?.name ?? '待補資料',
    phone: order.customer?.phone ?? snapshot?.phone ?? null,
  };
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
  return total > 1 ? `${firstLabel}，共 ${total} 項` : firstLabel;
}

function nextAction(order: OrderListRow) {
  if (order.omsStatus) {
    if (order.omsStatus === 'NEW' || order.omsStatus === 'REVIEW') {
      const waiting = !['paid', 'cod'].includes(order.paymentStatus);
      return { label: waiting ? '等待付款' : omsNextActionLabel(order.omsStatus, order.omsIssueFlags), hint: waiting ? '付款後繼續' : '現在處理' };
    }
    if (order.omsStatus === 'READY') return { label: '建立物流', hint: '已通過審核' };
    if (order.omsStatus === 'FULFILLMENT_PENDING') return { label: '等待交寄', hint: '已建立出貨單' };
    return { label: '已完成', hint: '已出貨' };
  }
  if (order.status === 'cancelled') return { label: '已取消', hint: '無需處理' };
  if (order.fulfillmentStatus === 'delivered' || order.status === 'completed') return { label: '已完成', hint: '交易完成' };
  if (order.fulfillmentStatus === 'shipped') return { label: '運送中', hint: '等待送達' };
  if (order.paymentStatus !== 'paid') return { label: '等待付款', hint: '尚未付款' };
  if (order.status === 'pending_review' || order.status === 'draft') return { label: '待確認', hint: '核對訂單' };
  return { label: '等待交寄', hint: '查看出貨進度' };
}

export function OrderListTable({ orders }: { orders: OrderListRow[] }) {
  if (orders.length === 0) {
    return (
      <Card className="p-0">
        <p className="py-10 text-center text-sm text-muted-foreground">沒有符合條件的訂單</p>
      </Card>
    );
  }

  return (
    <>
      {/* 手機：虛擬化卡片，免左右滑動 */}
      <div className="xl:hidden">
        <VirtualCardList
          items={orders}
          estimateSize={168}
          getKey={(o) => o.id}
          renderItem={(o) => <OrderCard order={o} />}
        />
      </div>

      {/* 桌機：只保留營運判斷需要的五欄。 */}
      <Card className="hidden overflow-hidden p-0 xl:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">訂單／客戶</TableHead>
              <TableHead className="w-[22%]">商品</TableHead>
              <TableHead className="w-[23%]">配送</TableHead>
              <TableHead className="w-[12%] text-right">金額</TableHead>
              <TableHead className="w-[15%]">下一步</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const logistics = resolveLogisticsForOrderList(o);
              const customer = orderCustomer(o);
              const action = nextAction(o);
              return (
                <TableRow key={o.id} className="group">
                  <TableCell className="min-w-0 align-top py-4">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <StatusBadge kind="orderSource" value={o.source} />
                      {o.customer ? (
                        <Link href={`/customers/${o.customer.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                          {customer.name}
                        </Link>
                      ) : (
                        <span className="truncate font-medium">{customer.name}</span>
                      )}
                    </div>
                    <Link href={`/orders/${o.id}`} className="mt-1 block font-mono text-xs text-muted-foreground hover:underline">{o.externalOrderName || o.orderNumber} · {formatDateTime(o.orderedAt)}</Link>
                  </TableCell>
                  <TableCell className="min-w-0 align-top py-4 text-sm">
                    <p className="line-clamp-2 break-words font-medium">{orderItemSummary(o)}</p>
                  </TableCell>
                  <TableCell className="min-w-0 align-top py-4">
                    <div className="min-w-0 break-words"><LogisticsSummary logistics={logistics} compact /></div>
                  </TableCell>
                  <TableCell className="align-top py-4 text-right">
                    <p className="font-semibold tabular-nums">{formatCurrency(Number(o.total))}</p>
                    <div className="mt-1 flex justify-end"><StatusBadge kind="payment" value={o.paymentStatus} /></div>
                  </TableCell>
                  <TableCell className="min-w-0 align-top py-4">
                    <Link href={`/orders/${o.id}`} className="flex items-start justify-between gap-2 rounded-md p-1 -m-1 hover:bg-muted">
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">{action.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{action.hint}</span>
                      </span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function OrderCard({ order: o }: { order: OrderListRow }) {
  const logistics = resolveLogisticsForOrderList(o);
  const customer = orderCustomer(o);
  const action = nextAction(o);

  return (
    <article
      className="block rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors active:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="orderSource" value={o.source} />
            {o.customer ? <Link href={`/customers/${o.customer.id}`} className="truncate text-sm font-semibold text-foreground hover:underline">{customer.name}</Link>
              : <span className="truncate text-sm font-semibold text-foreground">{customer.name}</span>}
          </div>
          <Link href={`/orders/${o.id}`} className="mt-1 block font-mono text-xs text-muted-foreground hover:underline">{o.externalOrderName || o.orderNumber}</Link>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums">{formatCurrency(Number(o.total))}</p>
          <StatusBadge kind="payment" value={o.paymentStatus} />
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm font-medium">{orderItemSummary(o)}</p>
      <div className="mt-2 rounded-xl bg-muted/30 px-3 py-2.5">
        <LogisticsSummary logistics={logistics} compact />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <span>{formatDateTime(o.orderedAt)}</span>
        <Link href={`/orders/${o.id}`} className="flex items-center gap-1 text-sm font-semibold hover:underline">
          <span>
            {action.label}
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
