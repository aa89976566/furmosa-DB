import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmptyHint } from '@/components/customers/customer-detail-ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';
import { orderStatusLabel } from '@/lib/labels';
import type { CustomerDetailData } from '@/lib/customers/load-customer-detail';

type Activity = {
  id: string;
  label: string;
  title: string;
  detail: string;
  at: Date;
  href?: string;
};

export function CustomerActivityTimeline({ data }: { data: CustomerDetailData }) {
  const activities: Activity[] = [
    ...data.recentPointsLedger.map((row) => ({
      id: `ledger-${row.id}`,
      label: '點數',
      title: `${row.pointsChange > 0 ? '+' : ''}${row.pointsChange} 點`,
      detail: `${ledgerSourceLabel[row.sourceType] ?? row.sourceType}${row.note ? ` · ${row.note}` : ''}`,
      at: row.createdAt,
      href: `/customers/${data.customer.id}/jar-ledger`,
    })),
    ...data.customer.orders.map((order) => ({
      id: `order-${order.id}`,
      label: '訂單',
      title: order.orderNumber,
      detail: `${orderStatusLabel[order.status] ?? order.status} · ${formatCurrency(Number(order.total))}`,
      at: order.orderedAt,
      href: `/orders/${order.id}`,
    })),
    ...data.recentAppointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      label: '預約',
      title: appointment.serviceName,
      detail: appointment.merchant.name,
      at: appointment.startsAt,
    })),
    {
      id: `customer-${data.customer.id}`,
      label: '會員',
      title: '建立會員資料',
      detail: data.customer.customerId,
      at: data.customer.createdAt,
    },
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  if (activities.length === 0) return <EmptyHint>尚無活動紀錄</EmptyHint>;

  return (
    <ol className="divide-y divide-border rounded-2xl border border-border bg-card px-5 shadow-card">
      {activities.map((activity) => {
        const content = (
          <div className="flex items-start gap-4 py-4">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
              {activity.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{activity.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{activity.detail}</p>
            </div>
            <time className="shrink-0 text-right text-[11px] text-muted-foreground">
              {formatDateTime(activity.at)}
            </time>
          </div>
        );

        return (
          <li key={activity.id}>
            {activity.href ? (
              <Link href={activity.href} className="block transition-colors hover:bg-muted/25">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
