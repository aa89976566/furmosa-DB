'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Minus, Search, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProductReadiness, ProductSetupItem } from '@/lib/products/readiness';

export type ProductManagementRow = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  searchableSkus: string[];
  imageUrl: string | null;
  categoryLabel: string;
  vendorName: string | null;
  status: string;
  statusLabel: string;
  priceRange: string;
  onHand: number;
  lowStock: boolean;
  readiness: ProductReadiness;
};

type SetupFilter = 'all' | 'attention' | 'variants' | 'consignment' | 'wholesale';

function normalizeSearch(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-TW');
}

function matchesSetup(row: ProductManagementRow, filter: SetupFilter) {
  if (filter === 'all') return true;
  if (filter === 'attention') return row.readiness.needsAttention;
  return row.readiness[filter].state === 'incomplete';
}

export function ProductManagementList({ rows, initialQuery = '' }: {
  rows: ProductManagementRow[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [setupFilter, setSetupFilter] = useState<SetupFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const counts = useMemo(() => ({
    all: rows.length,
    attention: rows.filter((row) => row.readiness.needsAttention).length,
    variants: rows.filter((row) => row.readiness.variants.state === 'incomplete').length,
    consignment: rows.filter((row) => row.readiness.consignment.state === 'incomplete').length,
    wholesale: rows.filter((row) => row.readiness.wholesale.state === 'incomplete').length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    const needle = normalizeSearch(query);
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!matchesSetup(row, setupFilter)) return false;
      if (!needle) return true;
      return normalizeSearch([
        row.name,
        row.productId,
        row.sku,
        row.categoryLabel,
        row.vendorName ?? '',
        ...row.searchableSkus,
      ].join(' ')).includes(needle);
    });
  }, [query, rows, setupFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">搜尋商品</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋商品名稱、編號或 SKU"
              className="h-11 pl-10"
            />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="商品設定篩選">
            <FilterButton active={setupFilter === 'all'} onClick={() => setSetupFilter('all')}>
              全部 {counts.all}
            </FilterButton>
            <FilterButton active={setupFilter === 'attention'} onClick={() => setSetupFilter('attention')}>
              待補設定 {counts.attention}
            </FilterButton>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-lg border bg-background px-3 text-sm font-medium"
            aria-label="商品狀態"
          >
            <option value="all">全部狀態</option>
            <option value="active">上架</option>
            <option value="inactive">下架</option>
            <option value="draft">草稿</option>
          </select>
        </div>

        {setupFilter !== 'all' || counts.attention > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" aria-label="缺少的設定">
            <FilterButton active={setupFilter === 'variants'} onClick={() => setSetupFilter('variants')} subtle>
              缺規格／SKU {counts.variants}
            </FilterButton>
            <FilterButton active={setupFilter === 'consignment'} onClick={() => setSetupFilter('consignment')} subtle>
              缺寄賣佣金 {counts.consignment}
            </FilterButton>
            <FilterButton active={setupFilter === 'wholesale'} onClick={() => setSetupFilter('wholesale')} subtle>
              缺買斷價 {counts.wholesale}
            </FilterButton>
          </div>
        ) : null}
      </div>

      {counts.attention > 0 && setupFilter === 'all' ? (
        <button
          type="button"
          onClick={() => setSetupFilter('attention')}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/5 px-4 py-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            {counts.attention} 個商品尚未完成必要設定
          </span>
          <span className="shrink-0 text-sm font-semibold underline underline-offset-4">查看待辦</span>
        </button>
      ) : null}

      <div className="space-y-3">
        {visibleRows.map((row) => <ProductRow key={row.id} row={row} />)}
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="font-semibold">
            {setupFilter === 'attention'
              ? '所有已啟用的設定都已完成'
              : `找不到「${query.trim()}」`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {setupFilter === 'attention' ? '目前沒有需要補設定的商品。' : '試試商品編號或 SKU。'}
          </p>
        </div>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">顯示 {visibleRows.length} 筆商品</p>
    </div>
  );
}

function FilterButton({ active, subtle = false, onClick, children }: {
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-10 rounded-lg border px-3 text-sm font-semibold transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:bg-muted',
        subtle && !active && 'border-border/70 font-medium text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ProductRow({ row }: { row: ProductManagementRow }) {
  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card px-4 py-3 transition-colors hover:bg-muted/15">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(150px,1fr))_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground">無圖</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/products/${row.id}`} className="min-w-0 break-words font-semibold underline-offset-4 hover:underline">
                {row.name}
              </Link>
              <Badge variant={row.status === 'active' ? 'success' : 'muted'}>{row.statusLabel}</Badge>
            </div>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{row.productId} · {row.sku}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.categoryLabel} · {row.vendorName ?? '未指定廠商'} · {row.priceRange} · 庫存 <span className={row.lowStock ? 'font-semibold text-warning' : 'text-foreground'}>{row.onHand}</span>
            </p>
          </div>
        </div>

        <SetupStatus title="規格 / SKU" item={row.readiness.variants} productId={row.id} />
        <SetupStatus title="寄賣" item={row.readiness.consignment} productId={row.id} />
        <SetupStatus title="買斷" item={row.readiness.wholesale} productId={row.id} />

        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/products/${row.id}`}><Settings2 className="mr-1 h-4 w-4" />編輯</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function SetupStatus({ title, item, productId }: {
  title: string;
  item: ProductSetupItem;
  productId: string;
}) {
  const Icon = item.state === 'complete' ? CheckCircle2 : item.state === 'incomplete' ? AlertTriangle : Minus;
  const href = `/products/${productId}#product-${item.section}`;
  return (
    <div className="min-w-0 border-t border-border/60 pt-3 xl:border-0 xl:pt-0">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn(
          'h-4 w-4 shrink-0',
          item.state === 'complete' ? 'text-success' : item.state === 'incomplete' ? 'text-warning' : 'text-muted-foreground',
        )} />
        <span className="truncate text-xs font-semibold">{title}</span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{item.summary}</p>
      {item.actionLabel && item.state === 'incomplete' ? (
        <Link href={href} className="mt-1 inline-flex text-xs font-semibold text-foreground underline underline-offset-4">
          {item.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
