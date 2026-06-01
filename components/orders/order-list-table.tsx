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
import { formatCurrency, formatDateTime } from '@/lib/format';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { shipmentStatusLabel } from '@/lib/shipment';
import type { Prisma } from '@prisma/client';
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { ChevronRight, Package } from 'lucide-react';

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

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
      {/* 手機：卡片式呈現，免左右滑動 */}
      <div className="space-y-3 md:hidden">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>

      {/* 桌機：完整表格 */}
      <Card className="hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>訂單編號</TableHead>
              <TableHead>來源</TableHead>
              <TableHead>客戶</TableHead>
              <TableHead>店家</TableHead>
              <TableHead className="min-w-[10rem]">運輸資訊</TableHead>
              <TableHead className="text-right">品項</TableHead>
              <TableHead className="text-right">總額</TableHead>
              <TableHead>付款</TableHead>
              <TableHead>出貨</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>下單時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const logistics = resolveLogisticsForOrderList(o);
              return (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/orders/${o.id}`} className="font-mono text-xs hover:underline">
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="orderSource" value={o.source} />
                  </TableCell>
                  <TableCell className="text-sm">{o.customer?.name ?? '-'}</TableCell>
                  <TableCell className="text-sm">
                    {o.merchant ? (
                      <Link
                        href={`/merchants/${o.merchant.id}`}
                        className="text-info hover:underline"
                      >
                        {o.merchant.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <LogisticsSummary logistics={logistics} compact />
                  </TableCell>
                  <TableCell className="text-right">{o._count.items}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(o.total))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="payment" value={o.paymentStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <StatusBadge kind="fulfillment" value={o.fulfillmentStatus} />
                      {o.shipments[0] ? (
                        <Link
                          href={`/shipments/${o.shipments[0].id}`}
                          className="block font-mono text-[11px] text-info hover:underline"
                        >
                          {o.shipments[0].shipmentNumber} ·{' '}
                          {shipmentStatusLabel[o.shipments[0].status] ?? o.shipments[0].status}
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="order" value={o.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(o.orderedAt)}
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
  const counterparty = o.customer?.name ?? o.merchant?.name ?? '—';
  const shipment = o.shipments[0];

  return (
    <Link
      href={`/orders/${o.id}`}
      className="block rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors active:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{o.orderNumber}</span>
            <StatusBadge kind="orderSource" value={o.source} />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{counterparty}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-right">
          <div>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(Number(o.total))}</p>
            <p className="text-[11px] text-muted-foreground">
              <Package className="mr-0.5 inline h-3 w-3 align-[-1px]" />
              {o._count.items} 項
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-muted/30 px-3 py-2.5">
        <LogisticsSummary logistics={logistics} compact />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge kind="order" value={o.status} />
        <StatusBadge kind="payment" value={o.paymentStatus} />
        <StatusBadge kind="fulfillment" value={o.fulfillmentStatus} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{formatDateTime(o.orderedAt)}</span>
        {shipment ? (
          <span className="truncate font-mono text-info">
            {shipment.shipmentNumber} · {shipmentStatusLabel[shipment.status] ?? shipment.status}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
