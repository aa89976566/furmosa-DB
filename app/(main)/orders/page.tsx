import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionSkeleton } from '@/components/shared/page-skeleton';
import { ListPagination } from '@/components/shared/list-pagination';
import { OrderListTable } from '@/components/orders/order-list-table';
import { Button } from '@/components/ui/button';
import {
  hrefWithPage,
  ORDER_PAGE_SIZE,
  parsePage,
  totalPages,
} from '@/lib/list-pagination';
import { historicalOrderWhere, ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { orderWorkWhere, workbenchVisibleWhere, workbenchHref, omsSourceSearchWhere } from '@/lib/orders/oms-workbench';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS, ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { Plus } from 'lucide-react';
import { ShopifyReconcilePanel } from '@/components/orders/shopify-reconcile-panel';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;
type SearchParams = { source?: string; status?: string; q?: string; page?: string; oms?: string; work?: string; deleted?: string; archived?: string };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function OrdersTotalsFallback() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40 sm:w-32" />
      ))}
    </div>
  );
}

function activeWorkFilter(searchParams: SearchParams) {
  if (searchParams.archived === 'true') return 'history';
  if ((searchParams.q ?? '').trim()) return 'all';
  if (searchParams.deleted === 'true') return 'all';
  if (searchParams.work) return searchParams.work;
  if (searchParams.oms === 'READY') return 'ready';
  if (searchParams.oms === 'FULFILLMENT_PENDING') return 'shipping';
  if (searchParams.oms === 'FULFILLED') return 'done';
  if (searchParams.oms === 'issues' || searchParams.oms === 'NEW' || searchParams.oms === 'REVIEW') return 'now';
  return 'now';
}

async function OrdersWorkSummary({ active }: { active: string }) {
  const count = (work: string) => prisma.order.count({
    where: { AND: [workbenchVisibleWhere, orderWorkWhere(work)] },
  });
  const [now, ready, shipping] = await Promise.all([
    count('now'),
    count('ready'),
    count('shipping'),
  ]);
  const cards = [
    { key: 'now', label: '待處理', count: now, help: '核對新訂單與資料異常' },
    { key: 'ready', label: '待出貨', count: ready, help: '建立物流或完成備貨' },
    { key: 'shipping', label: '運送中', count: shipping, help: '追蹤已交寄訂單' },
  ].filter(card => card.count > 0);

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">目前沒有需要處理的訂單</p>;
  }

  return <nav aria-label="目前工作">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">目前工作</p>
    <div className="grid grid-cols-3 gap-2 sm:flex">
      {cards.map(card => <Link key={card.key} href={`/orders?work=${card.key}`} prefetch={false} title={card.help} className={`flex min-h-14 min-w-0 flex-col justify-center rounded-xl border px-3 py-2 transition sm:min-w-32 ${active === card.key ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-primary/40'}`}>
        <span className="truncate text-xs font-medium sm:text-sm">{card.label}</span>
        <span className="text-lg font-semibold tabular-nums">{card.count}</span>
      </Link>)}
    </div>
  </nav>;
}

async function OrdersTableSection({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = (searchParams.q ?? '').trim();
  const isSearching = q.length > 0;
  const activeWork = activeWorkFilter(searchParams);
  const where: Record<string, unknown> = { AND: [
    searchParams.archived === 'true'
      ? historicalOrderWhere
      : isSearching
      ? workbenchVisibleWhere
      : searchParams.deleted === 'true'
        ? { deletedAt: { not: null } }
        : workbenchVisibleWhere,
    searchParams.archived === 'true' || isSearching || activeWork === 'all' ? {} : orderWorkWhere(activeWork),
  ] };
  const sourceFilter =
    searchParams.source === 'restock' ? 'consignment' : searchParams.source;
  if (!isSearching && sourceFilter && (ORDER_SOURCES as readonly string[]).includes(sourceFilter)) {
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
    !isSearching &&
    searchParams.status &&
    (activeStatuses as readonly string[]).includes(
      searchParams.status as (typeof activeStatuses)[number],
    )
  ) {
    where.status = searchParams.status;
  }
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
      orderBy: activeWork === 'all' || activeWork === 'done' ? [{ orderedAt: 'desc' }, { id: 'desc' }] : [{ orderedAt: 'asc' }, { id: 'asc' }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    });
  const filterState = {
    source: searchParams.source,
    status: searchParams.status,
    q: searchParams.q,
    work: activeWork, deleted: searchParams.deleted, archived: searchParams.archived,
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
      <OrderListTable orders={orders} showOrderDate={isSearching} />
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

export default async function OrdersPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const activeWork = activeWorkFilter(searchParams);
  return (
    <>
      <PageHeader
        tone="orders"
        title="訂單"
        compact
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
        <Suspense fallback={<OrdersTotalsFallback />}><OrdersWorkSummary active={activeWork} /></Suspense>
        <div className="flex flex-wrap items-start justify-between gap-2 border-y py-3">
          <details className="relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-lg border bg-card px-3 text-sm font-medium">
              來源：{ORDER_SOURCE_TABS.find((item) => item.key === (searchParams.source ?? ''))?.label ?? '全部'}
            </summary>
            <div className="absolute left-0 top-11 z-30 min-w-36 space-y-1 rounded-xl border bg-card p-2 shadow-lg">
              {ORDER_SOURCE_TABS.map((source) => <Link key={source.key || 'all'} href={workbenchHref(searchParams, { source: source.key, page: undefined })} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">{source.label}</Link>)}
            </div>
          </details>
          <details className="relative ml-auto">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-lg border bg-card px-3 text-sm font-medium">同步與管理</summary>
            <div className="absolute right-0 top-11 z-30 w-[min(90vw,28rem)] space-y-3 rounded-xl border bg-card p-4 shadow-lg">
              <Suspense fallback={null}><ShopifyReconcilePanel /></Suspense>
              <div className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
                <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/orders?work=all">全部訂單</Link>
                <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/orders?work=waiting">待付款</Link>
                <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/orders?work=done">已完成</Link>
                <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/orders?archived=true">歷史訂單</Link>
              </div>
              <Link className="block text-sm text-info hover:underline" href="/orders?deleted=true">查看已移出的訂單</Link>
            </div>
          </details>
        </div>
        {searchParams.deleted === 'true' ? <p className="text-sm">目前顯示已移出的訂單 · <Link className="underline" href="/orders">返回一般清單</Link></p> : null}
        {searchParams.archived === 'true' ? <p className="text-sm">目前顯示歷史訂單；原始金額、付款與出貨資料均保留。 · <Link className="underline" href="/orders">返回工作清單</Link></p> : null}

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
