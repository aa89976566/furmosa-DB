import Link from 'next/link';
import { ArrowLeft, ChevronRight, Search, TriangleAlert } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VALID_FILTERS = ['pending', 'linked', 'blocked', 'all'] as const;
type CandidateFilter = (typeof VALID_FILTERS)[number];

function filterHref(filter: CandidateFilter, q: string) {
  const params = new URLSearchParams();
  if (filter !== 'pending') params.set('filter', filter);
  if (q) params.set('q', q);
  const query = params.toString();
  return `/products/shopify-candidates${query ? `?${query}` : ''}`;
}

export default async function ShopifyCandidatesPage(props: {
  searchParams?: Promise<{ q?: string; filter?: string }>;
}) {
  const searchParams = await props.searchParams;
  const q = (searchParams?.q ?? '').trim();
  const requestedFilter = searchParams?.filter ?? 'pending';
  const filter: CandidateFilter = (VALID_FILTERS as readonly string[]).includes(requestedFilter)
    ? requestedFilter as CandidateFilter
    : 'pending';
  const where: Prisma.ShopifyCatalogCandidateWhereInput = {
    ...(filter === 'all' ? {} : { resolution: filter }),
    ...(q ? { OR: [
      { productTitle: { contains: q, mode: 'insensitive' } },
      { variantTitle: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ] } : {}),
  };
  const [visibleRows, pending, linked, blocked, created] = await Promise.all([
    prisma.shopifyCatalogCandidate.findMany({ where, orderBy: [{ productTitle: 'asc' }, { variantTitle: 'asc' }], take: 500 }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'pending' } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'linked' } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'blocked' } }),
    prisma.shopifyCatalogCandidate.count({ where: { resolution: 'created' } }),
  ]);
  const visibleProductIds = [...new Set(visibleRows.map((row) => row.shopifyProductId))];
  const rows = visibleProductIds.length ? await prisma.shopifyCatalogCandidate.findMany({
    where: {
      shopifyProductId: { in: visibleProductIds },
      resolution: { in: ['pending', 'linked', 'blocked', 'created'] },
    },
    orderBy: [{ productTitle: 'asc' }, { variantTitle: 'asc' }],
  }) : [];
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(row.shopifyProductId, [...(groups.get(row.shopifyProductId) ?? []), row]);
  const processed = linked + blocked + created;
  const total = pending + processed;

  return (
    <>
      <PageHeader
        title="Shopify 商品確認"
        description="逐項確認 Shopify 與 HQ 的對應；系統不會猜成本、建立庫存或自動上架。"
        actions={<Button variant="outline" size="sm" asChild><Link href="/products/shopify-audit"><ArrowLeft className="mr-1 h-4 w-4" />返回商品檢查</Link></Button>}
      />
      <div className="space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="待確認" value={pending} tone="warning" />
          <SummaryCard label="已處理" value={processed} tone="safe" />
          <SummaryCard label="處理進度" value={total ? `${Math.round((processed / total) * 100)}%` : '100%'} />
        </section>
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="space-y-4 border-b border-border p-4 sm:p-5">
            <form className="flex gap-2" action="/products/shopify-candidates">
              {filter !== 'pending' ? <input type="hidden" name="filter" value={filter} /> : null}
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input name="q" defaultValue={q} placeholder="搜尋商品、規格或 SKU" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </label>
              <Button type="submit">搜尋</Button>
            </form>
            <nav className="flex flex-wrap gap-2" aria-label="商品確認篩選">
              <FilterLink active={filter === 'pending'} href={filterHref('pending', q)}>待確認 {pending}</FilterLink>
              <FilterLink active={filter === 'linked'} href={filterHref('linked', q)}>已連結 {linked}</FilterLink>
              <FilterLink active={filter === 'blocked'} href={filterHref('blocked', q)}>這次不建立 {blocked}</FilterLink>
              <FilterLink active={filter === 'all'} href={filterHref('all', q)}>全部 {total}</FilterLink>
            </nav>
          </div>
          {groups.size ? (
            <div className="divide-y divide-border">
              {[...groups.entries()].map(([productId, variants]) => {
                const pendingCount = variants.filter((row) => row.resolution === 'pending').length;
                const first = variants[0]!;
                return (
                  <Link key={productId} href={`/products/shopify-candidates/${first.id}`} className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{first.productTitle}</h2>
                        <span className={pendingCount ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900' : 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900'}>{pendingCount ? `${pendingCount} 個待確認` : '本頁已處理'}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{variants.length} 個規格 · {variants.map((row) => row.variantTitle || '預設規格').slice(0, 3).join('、')}{variants.length > 3 ? '…' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">{pendingCount ? '開始／繼續處理' : '查看結果'}<ChevronRight className="h-4 w-4" /></div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex items-start gap-3 px-5 py-8 text-sm text-muted-foreground"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{q ? '找不到符合條件的商品。' : '這個分類目前沒有商品。'}</p></div>
          )}
        </section>
        {visibleRows.length >= 500 ? <p className="text-sm text-muted-foreground">目前先顯示前 500 個規格，請用搜尋縮小範圍。</p> : null}
      </div>
    </>
  );
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'safe' | 'warning' }) {
  const className = tone === 'safe' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-border bg-card text-foreground';
  return <div className={`rounded-2xl border p-4 ${className}`}><p className="text-sm font-medium opacity-70">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p></div>;
}

function FilterLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link href={href} className={active ? 'rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white' : 'rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted'}>{children}</Link>;
}
