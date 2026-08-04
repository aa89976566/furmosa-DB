import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionSkeleton } from '@/components/shared/page-skeleton';
import { ListPagination } from '@/components/shared/list-pagination';
import { OrderListTable } from '@/components/orders/order-list-table';
import { OrdersListFilters } from '@/components/orders/orders-list-filters';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format';
import { getOrderHubKpis } from '@/lib/hot-path-reads';
import {
  hrefWithPage,
  ORDER_PAGE_SIZE,
  parsePage,
  totalPages,
} from '@/lib/list-pagination';
import { activeOrderWhere, ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS } from '@/lib/order-hub-kinds';
import { Plus, Search } from 'lucide-react';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;

export const dynamic = 'force-dynamic';

function OrdersKpiFallback() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink/80" />
      ))}
    </div>
  );
}

async function OrdersKpiSection() {
  const kpis = await getOrderHubKpis();
  const cards = [
    { label: '本月營收', value: formatCurrency(kpis.monthRevenue) },
    { label: '今日筆數', value: formatNumber(kpis.todayCount) },
    { label: '待出貨', value: formatNumber(kpis.pendingFulfillmentCount) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="bento-kpi space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/55">
            {c.label}
          </p>
          <p className="font-display text-3xl font-semibold tracking-tight tabular-nums text-white md:text-4xl">
            {c.value}
          </p>
        </div>
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
  const q = searchParams.q ?? '';

  return (
    <>
      <PageHeader
        tone="orders"
        title="訂單"
        description="本月重點數字與訂單工作台"
        actions={
          <Button size="sm" asChild>
            <Link href="/orders/new">
              <Plus className="mr-1 h-4 w-4" />
              新建訂單
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        <form method="get" className="bento-card p-3 sm:p-4">
          {searchParams.source ? (
            <input type="hidden" name="source" value={searchParams.source} />
          ) : null}
          {searchParams.status ? (
            <input type="hidden" name="status" value={searchParams.status} />
          ) : null}
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="搜尋訂單編號、收件人、備註…"
              className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </form>

        <Suspense fallback={<OrdersKpiFallback />}>
          <OrdersKpiSection />
        </Suspense>

        <OrdersListFilters
          source={searchParams.source}
          status={searchParams.status}
          q={q || undefined}
        />

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
