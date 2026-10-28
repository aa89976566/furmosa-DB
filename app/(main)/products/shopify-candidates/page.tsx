import Link from 'next/link';
import { ArrowLeft, Search, TriangleAlert } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VALID_FILTERS = ['all', 'ready', 'missing-sku'] as const;
type CandidateFilter = (typeof VALID_FILTERS)[number];
const VALID_STATUSES = ['pending', 'linked', 'blocked', 'unavailable', 'all'] as const;
type CandidateStatus = (typeof VALID_STATUSES)[number];

function filterHref(filter: CandidateFilter, status: CandidateStatus, q: string) {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('filter', filter);
  if (status !== 'pending') params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString();
  return `/products/shopify-candidates${query ? `?${query}` : ''}`;
}

export default async function ShopifyCandidatesPage(props: {
  searchParams?: Promise<{ q?: string; filter?: string; status?: string; updated?: string }>;
}) {
  const searchParams = await props.searchParams;
  const q = (searchParams?.q ?? '').trim();
  const requestedFilter = searchParams?.filter ?? 'all';
  const filter: CandidateFilter = (VALID_FILTERS as readonly string[]).includes(requestedFilter)
    ? requestedFilter as CandidateFilter
    : 'all';
  const requestedStatus = searchParams?.status ?? 'pending';
  const status: CandidateStatus = (VALID_STATUSES as readonly string[]).includes(requestedStatus)
    ? requestedStatus as CandidateStatus
    : 'pending';

  const where: Prisma.ShopifyCatalogCandidateWhereInput = {
    ...(status === 'all' ? {} : { resolution: status }),
    ...(filter === 'ready' ? { sku: { not: null } } : {}),
    ...(filter === 'missing-sku' ? { sku: null } : {}),
    ...(q
      ? {
          OR: [
            { productTitle: { contains: q, mode: 'insensitive' } },
            { variantTitle: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total, withSku, missingSku, linked, blocked, unavailable] = await Promise.all([
    prisma.shopifyCatalogCandidate.findMany({
      where,
      orderBy: [{ productTitle: 'asc' }, { variantTitle: 'asc' }],
      take: 200,
    }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'pending' } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'pending', sku: { not: null } } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'pending', sku: null } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'linked' } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'blocked' } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'unavailable' } }),
  ]);

  return (
    <>
      <PageHeader
        title="Shopify 待建商品"
        description="先確認商品身分與販售決定；這裡不會自動建立庫存、成本或上架商品。"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/products/shopify-audit">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回商品檢查
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {searchParams?.updated ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {searchParams.updated === 'linked' ? '已安全連結 HQ 商品規格。' : '已標記為不需建立；商品與庫存均未修改。'}
          </div>
        ) : null}
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="全部待處理" value={total} />
          <SummaryCard label="已有 SKU" value={withSku} tone="safe" />
          <SummaryCard label="缺少 SKU" value={missingSku} tone="warning" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="space-y-4 border-b border-border p-4 sm:p-5">
            <form className="flex gap-2" action="/products/shopify-candidates">
              {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
              {status !== 'pending' ? <input type="hidden" name="status" value={status} /> : null}
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="搜尋商品名稱、規格或 SKU"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <Button type="submit">搜尋</Button>
            </form>

            <nav className="flex flex-wrap gap-2" aria-label="處理狀態篩選">
              <FilterLink active={status === 'pending'} href={filterHref(filter, 'pending', q)}>待處理 {total}</FilterLink>
              <FilterLink active={status === 'linked'} href={filterHref('all', 'linked', q)}>已連結 {linked}</FilterLink>
              <FilterLink active={status === 'blocked'} href={filterHref('all', 'blocked', q)}>不需建立 {blocked}</FilterLink>
              <FilterLink active={status === 'unavailable'} href={filterHref('all', 'unavailable', q)}>Shopify 已無待辦 {unavailable}</FilterLink>
            </nav>
            {status === 'pending' ? <nav className="flex flex-wrap gap-2" aria-label="SKU 篩選">
              <FilterLink active={filter === 'all'} href={filterHref('all', status, q)}>全部 {total}</FilterLink>
              <FilterLink active={filter === 'ready'} href={filterHref('ready', status, q)}>已有 SKU {withSku}</FilterLink>
              <FilterLink active={filter === 'missing-sku'} href={filterHref('missing-sku', status, q)}>缺少 SKU {missingSku}</FilterLink>
            </nav> : null}
          </div>

          {rows.length ? (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <article key={row.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{row.productTitle}</h2>
                      {row.sku ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">已有 SKU</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">需補 SKU</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">規格：{row.variantTitle || '預設規格'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.sku ? `SKU ${row.sku}` : 'Shopify 尚未設定 SKU'} · 售價 NT${Number(row.price).toLocaleString('zh-TW')}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <Button asChild variant={row.resolution === 'pending' ? 'default' : 'outline'} className="min-h-11">
                      <Link href={`/products/shopify-candidates/${row.id}`}>
                        {row.resolution === 'pending' ? '處理' : '查看'}
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 px-5 py-8 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{q ? '找不到符合條件的待建商品。' : '這個分類目前沒有待處理商品。'}</p>
            </div>
          )}
        </section>

        {rows.length >= 200 ? (
          <p className="text-sm text-muted-foreground">目前先顯示前 200 筆，請用搜尋縮小範圍。</p>
        ) : null}
      </div>
    </>
  );
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'safe' | 'warning' }) {
  const className = tone === 'safe'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-border bg-card text-foreground';
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FilterLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={active
        ? 'rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white'
        : 'rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted'}
    >
      {children}
    </Link>
  );
}
