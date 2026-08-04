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
import { StatusBadge } from '@/components/shared/status-badge';
import { VirtualCardList } from '@/components/shared/virtualized-rows';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Prisma } from '@prisma/client';
import {
  ORDER_LIST_INCLUDE,
  orderListCounterparty,
  orderListProductSummary,
} from '@/lib/order-list';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

function sourceLabel(order: OrderListRow) {
  if (order.customer?.name && order.merchant?.name) return order.merchant.name;
  if (order.source === 'consignment') return '寄賣';
  if (order.source === 'website') return '官網';
  if (order.source === 'line') return 'LINE';
  if (order.source === 'subscription') return '訂閱';
  return '手動';
}

export function OrderListTable({ orders }: { orders: OrderListRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="bento-card px-4 py-12 text-center text-sm text-muted-foreground">
        沒有符合條件的訂單
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <VirtualCardList
          items={orders}
          estimateSize={128}
          getKey={(o) => o.id}
          renderItem={(o) => <OrderCard order={o} />}
        />
      </div>

      <div className="bento-card hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="whitespace-nowrap pl-5">訂單編號</TableHead>
              <TableHead className="min-w-[7rem]">對象</TableHead>
              <TableHead className="min-w-[10rem]">商品</TableHead>
              <TableHead className="whitespace-nowrap text-right">總額</TableHead>
              <TableHead className="whitespace-nowrap">狀態</TableHead>
              <TableHead className="whitespace-nowrap pr-5">時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const party = orderListCounterparty(o);
              const unnamed = party === '未指定對象';
              return (
                <TableRow key={o.id} className="group">
                  <TableCell className="pl-5">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-xs font-medium text-ink hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'truncate font-medium',
                          unnamed ? 'text-muted-foreground' : 'text-ink',
                        )}
                      >
                        {party}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{sourceLabel(o)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="line-clamp-2 max-w-[16rem] text-sm text-foreground">
                      {orderListProductSummary(o)}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(Number(o.total))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="order" value={o.status} />
                  </TableCell>
                  <TableCell className="pr-5 text-sm text-muted-foreground tabular-nums">
                    {formatDateTime(o.orderedAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function OrderCard({ order: o }: { order: OrderListRow }) {
  const party = orderListCounterparty(o);
  return (
    <Link
      href={`/orders/${o.id}`}
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-4',
        'transition-colors active:bg-muted/40',
      )}
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-ink">{o.orderNumber}</p>
        <p
          className={cn(
            'mt-0.5 truncate text-sm',
            party === '未指定對象' ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {party}
          <span className="text-muted-foreground"> · {sourceLabel(o)}</span>
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {orderListProductSummary(o)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge kind="order" value={o.status} />
          <span className="text-[11px] text-muted-foreground">{formatDateTime(o.orderedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-right">
        <p className="text-base font-semibold tabular-nums">{formatCurrency(Number(o.total))}</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </div>
    </Link>
  );
}
