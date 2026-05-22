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
import { LogisticsSummary } from '@/components/shared/logistics-summary';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { shipmentStatusLabel } from '@/lib/shipment';
import type { Prisma } from '@prisma/client';
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

export function OrderListTable({ orders }: { orders: OrderListRow[] }) {
  if (orders.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">沒有符合條件的訂單</p>
    );
  }

  return (
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
  );
}
