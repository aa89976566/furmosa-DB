import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { OrderListTable } from '@/components/orders/order-list-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import { activeOrderWhere, historicalOrderWhere, ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { Plus, History } from 'lucide-react';

const ORDER_SOURCES = ['website', 'line', 'consignment', 'manual'] as const;

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { source?: string; status?: string; q?: string };
}) {
  const where: Record<string, unknown> = { ...activeOrderWhere };
  if (searchParams.source && (ORDER_SOURCES as readonly string[]).includes(searchParams.source)) {
    where.source = searchParams.source;
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
  if (q) {
    const contains = { contains: q, mode: 'insensitive' };
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { orderNumber: contains },
          { customer: { name: contains } },
          { customer: { phone: contains } },
          { merchant: { name: contains } },
        ],
      },
    ];
  }

  const [orders, totals, historyCount] = await Promise.all([
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
    prisma.order.count({ where: historicalOrderWhere }),
  ]);

  const sourceTabs: { key: string; label: string }[] = [
    { key: '', label: '全部' },
    { key: 'website', label: '官網' },
    { key: 'line', label: 'LINE' },
    { key: 'consignment', label: '寄賣' },
    { key: 'manual', label: '手動' },
  ];

  return (
    <>
      <PageHeader
        tone="orders"
        title="訂單 Order Hub"
        description="進行中訂單；已退貨或已取消請至歷史訂單"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/orders/history">
                <History className="mr-1 h-4 w-4" />
                歷史訂單 ({historyCount})
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/orders/new">
                <Plus className="mr-1 h-4 w-4" />
                新增訂單
              </Link>
            </Button>
          </div>
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
          {sourceTabs.map((s) => {
            const active = (searchParams.source ?? '') === s.key;
            const href = s.key ? `/orders?source=${s.key}` : '/orders';
            return (
              <Button key={s.key} variant={active ? 'default' : 'outline'} size="sm" asChild>
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
