import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { Plus, Repeat } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { key: undefined, label: '全部' },
  { key: 'active', label: '進行中' },
  { key: 'paused', label: '暫停' },
  { key: 'expired', label: '已到期' },
  { key: 'cancelled', label: '已取消' },
] as const;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const status = searchParams?.status;

  const [subs, statusCounts] = await Promise.all([
    prisma.subscription.findMany({
      where: status ? { status } : {},
      include: {
        customer: true,
        plan: true,
        _count: { select: { shipments: true } },
      },
      orderBy: [
        { status: 'asc' },
        { nextShipmentDate: 'asc' },
        { startDate: 'desc' },
      ],
    }),
    prisma.subscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="訂閱合約 Subscriptions"
        description="所有客戶訂閱合約 — 含進行中、暫停、到期、取消"
        actions={
          <Button size="sm" asChild>
            <Link href="/subscriptions/new">
              <Plus className="mr-1 h-4 w-4" />
              新增訂閱
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((t) => {
            const count =
              t.key === undefined
                ? statusCounts.reduce((sum, s) => sum + s._count._all, 0)
                : statusCounts.find((s) => s.status === t.key)?._count._all ?? 0;
            const active = (t.key ?? '') === (status ?? '');
            return (
              <Button
                key={t.key ?? 'all'}
                size="sm"
                variant={active ? 'default' : 'outline'}
                asChild
              >
                <Link href={t.key ? `/subscriptions?status=${t.key}` : '/subscriptions'}>
                  {t.label}
                  <span className="ml-2 text-xs opacity-70">{count}</span>
                </Link>
              </Button>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合約</TableHead>
                  <TableHead>客戶</TableHead>
                  <TableHead>方案</TableHead>
                  <TableHead>付款</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>開始</TableHead>
                  <TableHead>到期</TableHead>
                  <TableHead>下次出貨</TableHead>
                  <TableHead className="text-right">已出 / 排定</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/subscriptions/${s.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {s.subscriptionNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${s.customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.customer.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {s.customer.customerId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info" className="gap-1">
                        <Repeat className="h-3 w-3" />
                        {s.plan.name}
                      </Badge>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatCurrency(Number(s.plan.monthlyPrice))} / 月
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="subscriptionCycle" value={s.billingCycle} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="subscription" value={s.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(s.startDate)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.endDate ? formatDate(s.endDate) : '無限期'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.status === 'active' && s.nextShipmentDate ? (
                        <span className="font-medium">{formatDate(s.nextShipmentDate)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {s._count.shipments}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/subscriptions/${s.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {subs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      此狀態下沒有訂閱合約
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
