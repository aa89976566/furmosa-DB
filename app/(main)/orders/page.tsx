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
import { ORDER_WORK_FILTERS, orderWorkWhere, workbenchVisibleWhere, workbenchHref, omsSourceSearchWhere } from '@/lib/orders/oms-workbench';
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-md bg-muted/40" />
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
  const [summary] = await prisma.$queryRaw<Array<{ now: bigint; waiting: bigint; ready: bigint; shipping: bigint; done: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE oms_status IN ('NEW', 'REVIEW') AND "paymentStatus" IN ('paid', 'cod')) AS now,
      COUNT(*) FILTER (WHERE oms_status IN ('NEW', 'REVIEW') AND "paymentStatus" NOT IN ('paid', 'cod')) AS waiting,
      COUNT(*) FILTER (WHERE oms_status = 'READY') AS ready,
      COUNT(*) FILTER (WHERE oms_status = 'FULFILLMENT_PENDING') AS shipping,
      COUNT(*) FILTER (WHERE oms_status = 'FULFILLED') AS done
    FROM "Order"
    WHERE deleted_at IS NULL AND oms_status IS NOT NULL
  `;
  const cards = [
    { key: 'now', label: '待確認', count: Number(summary?.now ?? 0), help: '核對訂單內容' },
    { key: 'waiting', label: '等待中', count: Number(summary?.waiting ?? 0), help: '等待付款或回覆' },
    { key: 'ready', label: '可出貨', count: Number(summary?.ready ?? 0), help: '建立物流單' },
    { key: 'shipping', label: '待交寄', count: Number(summary?.shipping ?? 0), help: '物流單已建立' },
  ];
  return <section aria-labelledby="work-summary-title" className="space-y-3">
    <div><h2 id="work-summary-title" className="text-lg font-semibold">訂單工作</h2><p className="text-sm text-muted-foreground">每筆訂單只會出現在一個階段。</p></div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map(card => <Link key={card.key} href={`/orders?work=${card.key}`} prefetch={false} className={`rounded-xl border px-4 py-3 transition ${active === card.key ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card hover:border-primary/30'}`}>
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{card.label}</p><p className="text-xl font-semibold tabular-nums">{card.count}</p></div>
        <p className="mt-1 text-xs text-muted-foreground">{card.help}</p>
      </Link>)}
    </div>
  </section>;
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
      orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
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
        title="訂單工作"
        description="從現在要做的事情開始；付款等待、物流與完成訂單分開整理。"
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
        <details className="rounded-lg border bg-muted/10 p-3">
          <summary className="cursor-pointer text-sm font-medium">同步與管理工具</summary>
          <div className="mt-3 space-y-3 border-t pt-3">
            <Suspense fallback={null}><ShopifyReconcilePanel /></Suspense>
            <div className="flex flex-wrap gap-3 text-sm"><Link className="text-info hover:underline" href="/orders?deleted=true">已移出處理清單（可還原）</Link>{searchParams.deleted === 'true' && <><span>目前顯示已移出的訂單</span><Link className="underline" href="/orders">返回一般清單</Link></>}</div>
          </div>
        </details>
        <nav aria-label="其他訂單範圍" className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">查看</span>
          {ORDER_WORK_FILTERS.slice(4).map(filter => <Button key={filter.key} size="sm" variant={activeWork === filter.key ? 'default' : 'outline'} asChild>
            <Link href={workbenchHref(searchParams, { work: filter.key, oms: undefined, status: undefined, deleted: undefined })}>{filter.label}</Link>
          </Button>)}
          <Button size="sm" variant={activeWork === 'all' ? 'default' : 'outline'} asChild><Link href="/orders?work=all">所有訂單</Link></Button>
        </nav>
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
                <Link href={href} prefetch={false}>
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
