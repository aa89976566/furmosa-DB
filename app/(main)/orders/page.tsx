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
import { ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { orderWorkWhere, workbenchVisibleWhere, workbenchHref, omsSourceSearchWhere } from '@/lib/orders/oms-workbench';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS, ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { Plus } from 'lucide-react';
import { ShopifyReconcilePanel } from '@/components/orders/shopify-reconcile-panel';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;
type SearchParams = { source?: string; status?: string; q?: string; page?: string; oms?: string; work?: string; deleted?: string };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function OrdersTotalsFallback() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-muted/40" />
      ))}
    </div>
  );
}

function activeWorkFilter(searchParams: SearchParams) {
  if (searchParams.deleted === 'true') return 'all';
  if (searchParams.work) return searchParams.work;
  if (searchParams.oms === 'READY') return 'ready';
  if (searchParams.oms === 'FULFILLMENT_PENDING') return 'shipping';
  if (searchParams.oms === 'FULFILLED') return 'done';
  if (searchParams.oms === 'issues' || searchParams.oms === 'NEW' || searchParams.oms === 'REVIEW') return 'now';
  return 'now';
}

async function OrdersWorkSummary({ active }: { active: string }) {
  const [summary] = await prisma.$queryRaw<Array<{ all_orders: bigint; now: bigint; waiting: bigint; ready: bigint; shipping: bigint; done: bigint }>>`
    SELECT
      COUNT(*) AS all_orders,
      COUNT(*) FILTER (WHERE oms_status IN ('NEW', 'REVIEW') AND "paymentStatus" IN ('paid', 'cod')) AS now,
      COUNT(*) FILTER (WHERE oms_status IN ('NEW', 'REVIEW') AND "paymentStatus" NOT IN ('paid', 'cod')) AS waiting,
      COUNT(*) FILTER (WHERE oms_status = 'READY') AS ready,
      COUNT(*) FILTER (WHERE oms_status = 'FULFILLMENT_PENDING') AS shipping,
      COUNT(*) FILTER (WHERE oms_status = 'FULFILLED') AS done
    FROM "Order"
    WHERE deleted_at IS NULL
  `;
  const cards = [
    { key: 'all', label: '全部', count: Number(summary?.all_orders ?? 0) },
    { key: 'now', label: '待確認', count: Number(summary?.now ?? 0), help: '核對訂單內容' },
    { key: 'waiting', label: '等待中', count: Number(summary?.waiting ?? 0), help: '等待付款或回覆' },
    { key: 'ready', label: '可出貨', count: Number(summary?.ready ?? 0), help: '建立物流單' },
    { key: 'shipping', label: '待交寄', count: Number(summary?.shipping ?? 0), help: '物流單已建立' },
    { key: 'done', label: '已完成', count: Number(summary?.done ?? 0) },
  ];
  return <nav aria-label="訂單工作階段" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="flex min-w-max gap-2">
      {cards.map(card => <Link key={card.key} href={`/orders?work=${card.key}`} prefetch={false} title={card.help} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${active === card.key ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-primary/40'}`}>
        <span>{card.label}</span><span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${active === card.key ? 'bg-background/20' : 'bg-muted'}`}>{card.count}</span>
      </Link>)}
    </div>
  </nav>;
}

async function OrdersTableSection({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const activeWork = activeWorkFilter(searchParams);
  const where: Record<string, unknown> = { AND: [
    searchParams.deleted === 'true' ? { deletedAt: { not: null } } : workbenchVisibleWhere,
    activeWork === 'all' ? {} : orderWorkWhere(activeWork),
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
      orderBy: activeWork === 'all' || activeWork === 'done' ? [{ orderedAt: 'desc' }, { id: 'desc' }] : [{ orderedAt: 'asc' }, { id: 'asc' }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    });
  const filterState = {
    source: searchParams.source,
    status: searchParams.status,
    q: searchParams.q,
    work: activeWork, deleted: searchParams.deleted,
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
  const activeWork = activeWorkFilter(searchParams);
  return (
    <>
      <PageHeader
        tone="orders"
        title="訂單"
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
              <Link className="block text-sm text-info hover:underline" href="/orders?deleted=true">查看已移出的訂單</Link>
            </div>
          </details>
        </div>
        {searchParams.deleted === 'true' ? <p className="text-sm">目前顯示已移出的訂單 · <Link className="underline" href="/orders">返回一般清單</Link></p> : null}

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
