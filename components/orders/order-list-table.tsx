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
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

function counterparty(order: OrderListRow) {
  return order.customer?.name ?? order.merchant?.name ?? '—';
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
          estimateSize={112}
          getKey={(o) => o.id}
          renderItem={(o) => <OrderCard order={o} />}
        />
      </div>

      <div className="bento-card hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="whitespace-nowrap pl-5">訂單編號</TableHead>
              <TableHead className="min-w-[8rem]">對象</TableHead>
              <TableHead className="whitespace-nowrap text-right">總額</TableHead>
              <TableHead className="whitespace-nowrap">狀態</TableHead>
              <TableHead className="whitespace-nowrap pr-5">時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
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
                    <p className="truncate font-medium text-ink">{counterparty(o)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.customer?.name && o.merchant?.name
                        ? o.merchant.name
                        : o.source === 'consignment'
                          ? '寄賣'
                          : o.source === 'website'
                            ? '官網'
                            : o.source === 'line'
                              ? 'LINE'
                              : '手動'}
                    </p>
                  </div>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function OrderCard({ order: o }: { order: OrderListRow }) {
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
        <p className="mt-0.5 truncate text-sm text-foreground">{counterparty(o)}</p>
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
