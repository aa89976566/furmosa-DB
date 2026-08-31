import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionSkeleton } from '@/components/shared/page-skeleton';
import { ListPagination } from '@/components/shared/list-pagination';
import { OrderListTable } from '@/components/orders/order-list-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';
import { getOrderSourceTotals } from '@/lib/hot-path-reads';
import {
  hrefWithPage,
  ORDER_PAGE_SIZE,
  parsePage,
  totalPages,
} from '@/lib/list-pagination';
import { activeOrderWhere, ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS, ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { Plus } from 'lucide-react';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;

export const dynamic = 'force-dynamic';

function OrdersTotalsFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-md bg-muted/40" />
      ))}
    </div>
  );
}

async function OrdersTotalsSection() {
  const totals = await getOrderSourceTotals();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {totals.map((t) => (
        <Card key={t.source}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              <StatusBadge kind="orderSource" value={t.source} />
            </div>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(t.total)}</p>
            <p className="text-xs text-muted-foreground">{t.count} 筆訂單</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function OrdersTableSection({
  searchParams,
}: {
  searchParams: { source?: string; status?: string; q?: string; page?: string };
}) {
  const where: Record<string, unknown> = { ...activeOrderWhere };
  const sourceFilter =
    searchParams.source === 'restock' ? 'consignment' : searchParams.source;
  if (sourceFilter && (ORDER_SOURCES as readonly string[]).includes(sourceFilter)) {
    where.source = sourceFilter;
  }
  const activeStatuses = [
    'draft',
    'pending_review',
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

  const page = parsePage(searchParams.page);
  const pageSize = ORDER_PAGE_SIZE;

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const pages = totalPages(totalCount, pageSize);
  const safePage = Math.min(page, pages);
  const filterState = {
    source: searchParams.source,
    status: searchParams.status,
    q: searchParams.q,
  };

  return (
    <div className="space-y-3">
      <ListPagination
        page={safePage}
        totalPages={pages}
        totalCount={totalCount}
        pageSize={pageSize}
        prevHref={
          safePage > 1 ? hrefWithPage('/orders', filterState, safePage - 1) : null
        }
        nextHref={
          safePage < pages ? hrefWithPage('/orders', filterState, safePage + 1) : null
        }
        label="筆訂單"
      />
      <OrderListTable orders={orders} />
      {pages > 1 ? (
        <ListPagination
          page={safePage}
          totalPages={pages}
          totalCount={totalCount}
          pageSize={pageSize}
          prevHref={
            safePage > 1 ? hrefWithPage('/orders', filterState, safePage - 1) : null
          }
          nextHref={
            safePage < pages ? hrefWithPage('/orders', filterState, safePage + 1) : null
          }
          label="筆訂單"
        />
      ) : null}
    </div>
  );
}

export default function OrdersPage({
  searchParams,
}: {
  searchParams: { source?: string; status?: string; q?: string; page?: string };
}) {
  return (
    <>
      <PageHeader
        tone="orders"
        title="訂單 Order Hub"
        description="統一管理客戶訂單與店家寄賣、販售、換罐補貨。"
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
        <Suspense fallback={<OrdersTotalsFallback />}>
          <OrdersTotalsSection />
        </Suspense>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">種類</span>
          {ORDER_SOURCE_TABS.map((s) => {
            const active =
              (searchParams.source ?? '') === s.key ||
              (s.key === 'consignment' && searchParams.source === 'restock');
            const href = s.key ? `/orders?source=${s.key}` : '/orders';
            return (
              <Button
                key={s.key || 'all'}
                variant={active ? 'default' : 'outline'}
                size="sm"
                asChild
              >
                <Link href={href} prefetch>
                  {s.label}
                </Link>
              </Button>
            );
          })}
        </div>

        <Suspense
          key={`${searchParams.source ?? ''}|${searchParams.status ?? ''}|${searchParams.q ?? ''}|${searchParams.page ?? '1'}`}
          fallback={<SectionSkeleton rows={8} />}
        >
          <OrdersTableSection searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
