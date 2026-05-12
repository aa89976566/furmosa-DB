import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { Plus } from 'lucide-react';

const ORDER_SOURCES = ['website', 'line', 'consignment', 'manual'] as const;
const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { source?: string; status?: string };
}) {
  const where: any = {};
  if (searchParams.source && (ORDER_SOURCES as readonly string[]).includes(searchParams.source)) {
    where.source = searchParams.source;
  }
  if (searchParams.status && (ORDER_STATUSES as readonly string[]).includes(searchParams.status)) {
    where.status = searchParams.status;
  }

  const [orders, totals] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, merchant: true, _count: { select: { items: true } } },
      orderBy: { orderedAt: 'desc' },
      take: 100,
    }),
    prisma.order.groupBy({
      by: ['source'],
      _sum: { total: true },
      _count: { _all: true },
      where: { status: { not: 'cancelled' } },
    }),
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
        title="訂單 Order Hub"
        description="所有來源的訂單統一管理：官網 / LINE / 寄賣 / 手動"
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新增訂單
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {/* 來源 mini summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {totals.map((t) => (
            <Card key={t.source}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  <StatusBadge kind="orderSource" value={t.source} />
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(Number(t._sum.total ?? 0))}
                </p>
                <p className="text-xs text-muted-foreground">{t._count._all} 筆訂單</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {sourceTabs.map((s) => {
            const active = (searchParams.source ?? '') === s.key;
            const href = s.key ? `/orders?source=${s.key}` : '/orders';
            return (
              <Button
                key={s.key}
                variant={active ? 'default' : 'outline'}
                size="sm"
                asChild
              >
                <Link href={href}>{s.label}</Link>
              </Button>
            );
          })}
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>訂單編號</TableHead>
                <TableHead>來源</TableHead>
                <TableHead>客戶</TableHead>
                <TableHead>店家</TableHead>
                <TableHead className="text-right">品項</TableHead>
                <TableHead className="text-right">總額</TableHead>
                <TableHead>付款</TableHead>
                <TableHead>出貨</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>下單時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
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
                  <TableCell className="text-right">{o._count.items}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(o.total))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="payment" value={o.paymentStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="fulfillment" value={o.fulfillmentStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="order" value={o.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(o.orderedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
