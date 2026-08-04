import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { CustomersListFilters } from '@/components/customers/customers-list-filters';
import { CustomersList } from '@/components/customers/customers-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { customerSearchWhere, mergeSearchWhere } from '@/lib/site-search';
import { Plus } from 'lucide-react';

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
      <div className="space-y-4 p-4 sm:p-6">
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
            <CustomersList
              customers={customers}
              emptyLabel={q ? `找不到符合「${q}」的客戶` : '此分類沒有客戶'}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
