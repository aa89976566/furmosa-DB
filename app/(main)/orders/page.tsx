import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { OrderListTable } from '@/components/orders/order-list-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import { activeOrderWhere, ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { maintainShipmentQueueIntegrity } from '@/lib/shipment-queue-filters';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS, ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { Plus } from 'lucide-react';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { source?: string; status?: string; q?: string };
}) {
  await maintainShipmentQueueIntegrity();

  const where: Record<string, unknown> = { ...activeOrderWhere };
  const sourceFilter =
    searchParams.source === 'restock' ? 'consignment' : searchParams.source;
  if (sourceFilter && (ORDER_SOURCES as readonly string[]).includes(sourceFilter)) {
    where.source = sourceFilter;
  }
  const activeStatuses = [
    'draft',
    'confirmed',
    'packed',
    'shipped',
    'delivered',
    'completed',
  ] as const;
  if (
    searchParams.status &&
    (activeStatuses as readonly string[]).includes(
      searchParams.status as (typeof activeStatuses)[number],
    )
  ) {
    where.status = searchParams.status;
  }
  const q = (searchParams.q ?? '').trim();
  const searchClause = orderSearchWhere(q);
  if (searchClause) {
    Object.assign(where, mergeSearchWhere(where, searchClause));
  }

  const [orders, totals] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy: { orderedAt: 'desc' },
      take: 100,
    }),
    prisma.order.groupBy({
      by: ['source'],
      _sum: { total: true },
      _count: { _all: true },
      where: { ...activeOrderWhere },
    }),
  ]);

  return (
    <>
      <PageHeader
        tone="orders"
        title="訂單 Order Hub"
        description="統一訂單工作台 — 篩選「寄賣」可看到店進貨與寄賣成交，來源皆為寄賣"
        actions={
          <Button size="sm" asChild>
            <Link href="/orders/new">
              <Plus className="mr-1 h-4 w-4" />
              新增訂單
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {totals.map((t) => (
            <Card key={t.source}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  <StatusBadge kind="orderSource" value={t.source} />
                </div>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(Number(t._sum.total ?? 0))}
                </p>
                <p className="text-xs text-muted-foreground">{t._count._all} 筆訂單</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">種類</span>
          {ORDER_SOURCE_TABS.map((s) => {
            const active = (searchParams.source ?? '') === s.key || (s.key === 'consignment' && searchParams.source === 'restock');
            const href = s.key ? `/orders?source=${s.key}` : '/orders';
            return (
              <Button key={s.key || 'all'} variant={active ? 'default' : 'outline'} size="sm" asChild>
                <Link href={href}>{s.label}</Link>
              </Button>
            );
          })}
        </div>

        <OrderListTable orders={orders} />
      </div>
    </>
  );
}
