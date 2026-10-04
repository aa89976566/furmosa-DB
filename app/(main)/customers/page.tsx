import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { CustomersListFilters } from '@/components/customers/customers-list-filters';
import { Button } from '@/components/ui/button';
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

export default async function CustomersPage(
  props: {
    searchParams?: Promise<{ filter?: string; q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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
      select: {
        id: true,
        customerId: true,
        name: true,
        phone: true,
        type: true,
        lineUserId: true,
        lineDisplay: true,
        totalSpent: true,
        lastOrderAt: true,
        hasActiveSubscription: true,
        _count: { select: { orders: true, subscriptions: true } },
        subscriptions: {
          where: { status: 'active' },
          select: {
            id: true,
            plan: { select: { name: true } },
          },
          take: 1,
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: [{ lastOrderAt: 'desc' }, { customerId: 'asc' }],
      take: 150,
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
        title="客戶"
        description="集中查看聯絡方式、訂閱身份、訂單與累計消費。"
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
        <nav aria-label="客戶分類" className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-1 rounded-xl border border-border/70 bg-card p-1.5 sm:min-w-0">
            {filterTabs.map((t) => {
              const active = (t.key ?? '') === (filter ?? '');
              return (
                <Link
                  key={t.key ?? 'all'}
                  href={tabHref(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors sm:min-w-28 sm:flex-none ${active ? 'bg-black text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  <span>{t.label}</span>
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
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
                  <TableHead className="min-w-[16rem]">客戶</TableHead>
                  <TableHead>身份</TableHead>
                  <TableHead>聯絡</TableHead>
                  <TableHead className="text-right">消費</TableHead>
                  <TableHead>最近活動</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-mono">{c.customerId}</span>
                        <span>·</span>
                        <span>{customerTypeLabel[c.type]}</span>
                      </div>
                      {c.lineUserId ? (
                        <div className="mt-1 truncate text-xs text-muted-foreground">LINE {c.lineDisplay ?? c.lineUserId}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {c.subscriptions[0] ? (
                        <Badge variant="info" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          {c.subscriptions[0].plan.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">一般客戶</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-semibold tabular-nums">{formatCurrency(Number(c.totalSpent))}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{c._count.orders} 筆訂單</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.lastOrderAt ? formatDate(c.lastOrderAt) : '尚無訂單'}
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
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {q ? `找不到符合「${q}」的客戶` : '此分類沒有客戶'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </div>
      </div>
    </>
  );
}
