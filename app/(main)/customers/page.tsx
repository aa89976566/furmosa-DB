import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { CustomersListFilters } from '@/components/customers/customers-list-filters';
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
import { Badge } from '@/components/ui/badge';
import { customerTypeLabel } from '@/lib/labels';
import { formatCurrency, formatDate } from '@/lib/format';
import { customerSearchWhere, mergeSearchWhere } from '@/lib/site-search';
import { Plus, Repeat } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: { filter?: string; q?: string };
}) {
  const filter = searchParams?.filter;
  const q = (searchParams?.q ?? '').trim();

  const where: Record<string, unknown> =
    filter === 'subscription' ? { hasActiveSubscription: true } : {};

  if (q) {
    Object.assign(where, mergeSearchWhere(where, customerSearchWhere(q)));
  }

  const [customers, total, subCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: true, subscriptions: true } },
        subscriptions: {
          where: { status: 'active' },
          include: { plan: true },
          take: 1,
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: [{ lastOrderAt: 'desc' }, { customerId: 'asc' }],
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { hasActiveSubscription: true } }),
  ]);

  const filterTabs = [
    { key: undefined, label: '全部', count: total },
    { key: 'subscription', label: '訂閱中', count: subCount },
  ];

  const tabHref = (tabKey?: string) => {
    const params = new URLSearchParams();
    if (tabKey) params.set('filter', tabKey);
    if (q) params.set('q', q);
    const query = params.toString();
    return query ? `/customers?${query}` : '/customers';
  };

  return (
    <>
      <PageHeader
        title="客戶 Customers"
        description="一個人 = 一筆資料：含基本聯絡、訂閱、訂單史"
        actions={
          <Button size="sm" asChild>
            <Link href="/customers/new">
              <Plus className="mr-1 h-4 w-4" />
              新增客戶
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((t) => {
            const active = (t.key ?? '') === (filter ?? '');
            return (
              <Button
                key={t.key ?? 'all'}
                variant={active ? 'default' : 'outline'}
                size="sm"
                asChild
              >
                <Link href={tabHref(t.key)}>
                  {t.label}
                  <span className="ml-2 text-xs opacity-70">{t.count}</span>
                </Link>
              </Button>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-0">
            <Suspense fallback={null}>
              <CustomersListFilters
                q={q}
                filter={filter ?? ''}
                shown={customers.length}
                total={total}
              />
            </Suspense>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>編號</TableHead>
                  <TableHead>姓名 / LINE</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>身份</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead className="text-right">訂單</TableHead>
                  <TableHead className="text-right">累計消費</TableHead>
                  <TableHead>最近下單</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.customerId}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.lineUserId && (
                        <div className="text-xs text-muted-foreground">LINE: {c.lineDisplay ?? c.lineUserId}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.type === 'business' ? 'info' : 'secondary'}>
                        {customerTypeLabel[c.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      {c.subscriptions[0] ? (
                        <Badge variant="info" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          {c.subscriptions[0].plan.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">一般</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="text-right">{c._count.orders}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(c.totalSpent))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.lastOrderAt ? formatDate(c.lastOrderAt) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/customers/${c.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      {q ? `找不到符合「${q}」的客戶` : '此分類沒有客戶'}
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
