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
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { OMS_FILTERS, omsFilterWhere, workbenchVisibleWhere, workbenchHref, taiwanToday, omsSourceSearchWhere } from '@/lib/orders/oms-workbench';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS, ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { Plus } from 'lucide-react';
import { ShopifyReconcilePanel } from '@/components/orders/shopify-reconcile-panel';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;
type SearchParams = { source?: string; status?: string; q?: string; page?: string; oms?: string; day?: string; queue?: string };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    <section aria-label="全部訂單來源彙總">
    <p className="mb-2 text-xs text-muted-foreground">全部訂單來源彙總（不隨下方篩選變動；不是目前清單的筆數與金額）</p>
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
    </section>
  );
}

async function OrdersTableSection({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const where: Record<string, unknown> = { AND: [workbenchVisibleWhere, omsFilterWhere(searchParams.oms),
    ...(searchParams.day === 'today' ? [{ omsStatus: { not: null }, orderedAt: taiwanToday() }] : []),
    ...(searchParams.queue === 'review' ? [{ omsStatus: { in: ['NEW', 'REVIEW'] } }] : []),
  ] };
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
    Object.assign(where, mergeSearchWhere(where, { OR: [searchClause, omsSourceSearchWhere(q)] }));
  }

  const page = parsePage(searchParams.page);
  const pageSize = ORDER_PAGE_SIZE;

  const totalCount = await prisma.order.count({ where });
  const pages = totalPages(totalCount, pageSize);
  const safePage = Math.min(page, pages);
  const orders = await prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    });
  const filterState = {
    source: searchParams.source,
    status: searchParams.status,
    q: searchParams.q,
    oms: searchParams.oms, day: searchParams.day, queue: searchParams.queue,
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
  searchParams: SearchParams;
}) {
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
        <Suspense fallback={null}><ShopifyReconcilePanel /></Suspense>
        <nav aria-label="OMS 訂單階段" className="flex flex-wrap gap-2">
          {OMS_FILTERS.map(filter => <Button key={filter.key} size="sm" variant={(searchParams.oms ?? '') === filter.key ? 'default' : 'outline'} asChild>
            <Link href={workbenchHref(searchParams, { oms: filter.key, status: undefined, day: undefined, queue: undefined })}>{filter.label}</Link>
          </Button>)}
        </nav>
        <p className="text-xs text-muted-foreground">OMS 篩選只包含已納入新流程的訂單；舊流程訂單仍可在「所有訂單」查看。「有問題」包含提醒及尚未檢查。</p>
        {(searchParams.day === 'today' || searchParams.queue === 'review') && <p className="text-sm">
          目前篩選：{searchParams.day === 'today' ? '台灣時間今日下單' : '新訂單＋待審核'} · <Link className="underline" href={workbenchHref(searchParams, { day: undefined, queue: undefined })}>清除</Link>
        </p>}
        <Suspense fallback={<OrdersTotalsFallback />}>
          <OrdersTotalsSection />
        </Suspense>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">種類</span>
          {ORDER_SOURCE_TABS.map((s) => {
            const active =
              (searchParams.source ?? '') === s.key ||
              (s.key === 'consignment' && searchParams.source === 'restock');
            const href = workbenchHref(searchParams, { source: s.key });
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
          key={JSON.stringify(searchParams)}
          fallback={<SectionSkeleton rows={8} />}
        >
          <OrdersTableSection searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
