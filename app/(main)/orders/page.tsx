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
import { OMS_FILTERS, omsFilterWhere, workbenchVisibleWhere, workbenchHref, taiwanToday, omsSourceSearchWhere } from '@/lib/orders/oms-workbench';
import { mergeSearchWhere, orderSearchWhere } from '@/lib/site-search';
import { ORDER_SOURCE_KEYS, ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { Plus } from 'lucide-react';
import { ShopifyReconcilePanel } from '@/components/orders/shopify-reconcile-panel';

const ORDER_SOURCES = ORDER_SOURCE_KEYS;
type SearchParams = { source?: string; status?: string; q?: string; page?: string; oms?: string; day?: string; queue?: string; deleted?: string };

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

async function OrdersWorkSummary() {
  const day = taiwanToday();
  const [summary] = await prisma.$queryRaw<Array<{ today: bigint; review: bigint; issues: bigint; fulfillment_pending: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE "orderedAt" >= ${day.gte} AND "orderedAt" < ${day.lt}) AS today,
      COUNT(*) FILTER (WHERE oms_status IN ('NEW', 'REVIEW')) AS review,
      COUNT(*) FILTER (WHERE oms_checked_at IS NULL OR oms_issue_flags IS NULL OR oms_issue_flags <> '[]'::jsonb) AS issues,
      COUNT(*) FILTER (WHERE oms_status = 'FULFILLMENT_PENDING') AS fulfillment_pending
    FROM "Order"
    WHERE deleted_at IS NULL AND oms_status IS NOT NULL
  `;
  const today = Number(summary?.today ?? 0);
  const review = Number(summary?.review ?? 0);
  const issues = Number(summary?.issues ?? 0);
  const fulfillmentPending = Number(summary?.fulfillment_pending ?? 0);
  const cards = [
    { label: '今日新訂單', count: today, help: '台灣時間今天收到', href: '/orders?day=today' },
    { label: '待審核', count: review, help: '需要核對或確認', href: '/orders?queue=review' },
    { label: '有問題', count: issues, help: '優先處理異常資料', href: '/orders?oms=issues' },
    { label: '待出貨', count: fulfillmentPending, help: '已建立 HQ 出貨單', href: '/orders?oms=FULFILLMENT_PENDING' },
  ];
  return <section aria-labelledby="work-summary-title">
    <div className="mb-3">
      <h2 id="work-summary-title" className="text-lg font-semibold">今天需要處理</h2>
      <p className="text-sm text-muted-foreground">點選卡片即可只看該類訂單。</p>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(card => <Link key={card.label} href={card.href} prefetch={false} className="rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/20">
        <p className="text-sm font-medium">{card.label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{card.count}</p>
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
  const where: Record<string, unknown> = { AND: [searchParams.deleted === 'true' ? { deletedAt: { not: null } } : workbenchVisibleWhere, omsFilterWhere(searchParams.oms),
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
    oms: searchParams.oms, day: searchParams.day, queue: searchParams.queue, deleted: searchParams.deleted,
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
        description="先處理異常與待審核訂單，再安排出貨"
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
        <Suspense fallback={<OrdersTotalsFallback />}><OrdersWorkSummary /></Suspense>
        <details className="rounded-lg border bg-muted/10 p-3">
          <summary className="cursor-pointer text-sm font-medium">同步與管理工具</summary>
          <div className="mt-3 space-y-3 border-t pt-3">
            <Suspense fallback={null}><ShopifyReconcilePanel /></Suspense>
            <div className="flex flex-wrap gap-3 text-sm"><Link className="text-info hover:underline" href="/orders?deleted=true">已移出處理清單（可還原）</Link>{searchParams.deleted === 'true' && <><span>目前顯示已移出的訂單</span><Link className="underline" href="/orders">返回一般清單</Link></>}</div>
          </div>
        </details>
        <nav aria-label="OMS 訂單階段" className="flex flex-wrap gap-2">
          {OMS_FILTERS.map(filter => <Button key={filter.key} size="sm" variant={(searchParams.oms ?? '') === filter.key ? 'default' : 'outline'} asChild>
            <Link href={workbenchHref(searchParams, { oms: filter.key, status: undefined, day: undefined, queue: undefined, deleted: undefined })}>{filter.label}</Link>
          </Button>)}
        </nav>
        <p className="text-xs text-muted-foreground">OMS 篩選只包含已納入新流程的訂單；舊流程訂單仍可在「所有訂單」查看。「有問題」包含提醒及尚未檢查。</p>
        {(searchParams.day === 'today' || searchParams.queue === 'review') && <p className="text-sm">
          目前篩選：{searchParams.day === 'today' ? '台灣時間今日下單' : '新訂單＋待審核'} · <Link className="underline" href={workbenchHref(searchParams, { day: undefined, queue: undefined })}>清除</Link>
        </p>}
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
