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
import { mergeSearchWhere, subscriptionSearchWhere } from '@/lib/site-search';
import { Plus, Repeat, Activity, CircleDollarSign, Truck, PauseCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function monthlyValue(sub: { billingCycle: string; plan: { monthlyPrice: number; halfYearPrice: number | null } }): number {
  if (sub.billingCycle === 'halfyear') {
    return sub.plan.halfYearPrice != null ? Number(sub.plan.halfYearPrice) / 6 : Number(sub.plan.monthlyPrice);
  }
  return Number(sub.plan.monthlyPrice);
}

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
  searchParams?: { status?: string; q?: string };
}) {
  const status = searchParams?.status;
  const q = (searchParams?.q ?? '').trim();
  const subscriptionWhere: Record<string, unknown> = {
    ...(status ? { status } : {}),
    ...(subscriptionSearchWhere(q) ?? {}),
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [subs, statusCounts, activeSubs, dueThisMonth] = await Promise.all([
    prisma.subscription.findMany({
      where: subscriptionWhere,
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
    prisma.subscription.findMany({
      where: { status: 'active' },
      select: { billingCycle: true, plan: { select: { id: true, name: true, monthlyPrice: true, halfYearPrice: true } } },
    }),
    prisma.subscription.count({
      where: { status: 'active', nextShipmentDate: { gte: monthStart, lt: monthEnd } },
    }),
  ]);

  const activeCount = activeSubs.length;
  const pausedCount = statusCounts.find((s) => s.status === 'paused')?._count._all ?? 0;
  const mrr = activeSubs.reduce((sum, s) => sum + monthlyValue(s), 0);

  const planDist = Array.from(
    activeSubs.reduce((map, s) => {
      const cur = map.get(s.plan.id);
      if (cur) cur.count += 1;
      else map.set(s.plan.id, { name: s.plan.name, count: 1 });
      return map;
    }, new Map<string, { name: string; count: number }>()),
  )
    .map(([, v]) => v)
    .sort((a, b) => b.count - a.count);

  const stats = [
    { label: '進行中合約', value: String(activeCount), hint: '目前 active', icon: Activity, tone: 'text-success', bar: 'bg-success' },
    { label: '月經常性收入 MRR', value: formatCurrency(Math.round(mrr)), hint: '進行中合約換算每月', icon: CircleDollarSign, tone: 'text-primary', bar: 'bg-primary' },
    { label: '本月預計出貨', value: String(dueThisMonth), hint: `${now.getMonth() + 1} 月下次出貨`, icon: Truck, tone: 'text-info', bar: 'bg-info' },
    { label: '暫停中', value: String(pausedCount), hint: '已暫停合約', icon: PauseCircle, tone: 'text-warning', bar: 'bg-warning' },
  ] as const;

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="relative overflow-hidden">
                <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
                <CardContent className="space-y-1 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                    <Icon className={`h-4 w-4 ${s.tone}`} />
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.hint}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {planDist.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">方案分佈（進行中）</p>
              <div className="space-y-2.5">
                {planDist.map((p) => {
                  const pct = activeCount > 0 ? Math.round((p.count / activeCount) * 100) : 0;
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">
                          {p.count} 位 · {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
