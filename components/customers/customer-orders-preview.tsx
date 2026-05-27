import Link from 'next/link';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyHint } from '@/components/customers/customer-detail-ui';
import { formatCurrency, formatDate } from '@/lib/format';

export function CustomerOrdersPreview({
  orders,
  totalCount,
}: {
  orders: {
    id: string;
    orderNumber: string;
    source: string;
    status: string;
    total: number | { toString(): string };
    orderedAt: Date;
  }[];
  totalCount: number;
}) {
  return (
    <SectionCard
      title="訂單"
      description={totalCount > 0 ? `共 ${totalCount} 筆` : undefined}
      tone="orders"
      action={
        totalCount > orders.length ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders">全部訂單</Link>
          </Button>
        ) : null
      }
    >
      {orders.length === 0 ? (
        <EmptyHint>尚無訂單紀錄</EmptyHint>
      ) : (
        <ul className="divide-y divide-border/50">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-1 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{o.orderNumber}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusBadge kind="orderSource" value={o.source} />
                    <StatusBadge kind="order" value={o.status} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatCurrency(Number(o.total))}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(o.orderedAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
