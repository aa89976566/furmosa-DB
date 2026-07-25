'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { searchDashboard, type DashboardSearchResult } from '@/app/(main)/dashboard/actions';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { orderStatusLabel } from '@/lib/labels';
import {
  Loader2,
  Package,
  Search,
  ShoppingCart,
  Store,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const empty: DashboardSearchResult = { orders: [], customers: [], merchants: [], products: [] };

export function DashboardSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DashboardSearchResult>(empty);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const runSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResults(empty);
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const data = await searchDashboard(trimmed);
      setResults(data);
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const hasResults =
    results.orders.length > 0 ||
    results.customers.length > 0 ||
    results.merchants.length > 0 ||
    results.products.length > 0;
  const showPanel = open && query.trim().length > 0 && (pending || hasResults);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="搜尋店家、客人、電話、訂單…（結果含庫存／常買）"
          className="h-11 rounded-2xl border-border/70 bg-surface-raised pl-10 pr-10 shadow-card"
          autoComplete="off"
        />
        {pending ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {showPanel ? (
        <div
          className={cn(
            'absolute z-10 mt-2 max-h-[min(28rem,75vh)] w-full overflow-y-auto rounded-2xl border bg-card p-2 shadow-lg',
          )}
        >
          {!pending && !hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              找不到符合的訂單、客戶、店家或商品
            </p>
          ) : null}

          {results.orders.length > 0 ? (
            <ResultGroup icon={ShoppingCart} title="訂單">
              {results.orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <span className="font-mono font-medium text-info">{o.orderNumber}</span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {o.merchantName ?? o.customerName ?? o.recipientHint ?? '—'} ·{' '}
                    {orderStatusLabel[o.status] ?? o.status}
                  </span>
                  <span className="shrink-0 text-xs font-medium">
                    {formatCurrency(o.total)}
                  </span>
                </Link>
              ))}
            </ResultGroup>
          ) : null}

          {results.customers.length > 0 ? (
            <ResultGroup icon={UserRound} title="會員／客戶">
              {results.customers.map((c) => {
                const top = c.insight.topProducts[0];
                return (
                  <div
                    key={c.id}
                    className="rounded-lg px-3 py-2 hover:bg-muted/60"
                  >
                    <Link href={`/customers/${c.id}`} className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.customerId}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </span>
                    </Link>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      訂單 {formatNumber(c.insight.orderCount)}
                      {c.insight.lastOrderAt
                        ? ` · 最近 ${formatDate(c.insight.lastOrderAt)}`
                        : ''}
                      {top
                        ? ` · 常買 ${top.productName}（${formatNumber(top.quantity)}）`
                        : ''}
                    </p>
                    {c.insight.topProducts.length > 1 ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/90">
                        還買過：
                        {c.insight.topProducts
                          .slice(1)
                          .map((p) => p.productName)
                          .join('、')}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      <QuickLink href={`/customers/${c.id}`}>總覽</QuickLink>
                      <QuickLink href={`/orders?q=${encodeURIComponent(c.customerId)}`}>
                        訂單
                      </QuickLink>
                    </div>
                  </div>
                );
              })}
            </ResultGroup>
          ) : null}

          {results.merchants.length > 0 ? (
            <ResultGroup icon={Store} title="寄賣店家">
              {results.merchants.map((m) => {
                const i = m.insight;
                const stockHint =
                  i.outOfStockSkus > 0
                    ? `${i.outOfStockSkus} 缺貨`
                    : i.lowStockSkus > 0
                      ? `${i.lowStockSkus} 偏低`
                      : '庫存正常';
                return (
                  <div
                    key={m.id}
                    className="rounded-lg px-3 py-2 hover:bg-muted/60"
                  >
                    <Link
                      href={`/merchants/${m.id}`}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.merchantId}
                        {m.contactName ? ` · ${m.contactName}` : ''}
                      </span>
                    </Link>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      在庫 {formatNumber(i.stockUnits)} · {stockHint}
                      {i.lastRestockAt
                        ? ` · 最近叫貨 ${formatDate(i.lastRestockAt)}`
                        : ' · 尚無叫貨紀錄'}
                      {i.restockTxnCount90d > 0
                        ? ` · 90 天 ${formatNumber(i.restockTxnCount90d)} 次`
                        : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      <QuickLink href={`/merchants/${m.id}/products`}>庫存</QuickLink>
                      <QuickLink href={`/merchants/${m.id}/ledger?type=restock`}>
                        叫貨歷史
                      </QuickLink>
                      <QuickLink href={`/merchants/${m.id}/restock`}>叫貨</QuickLink>
                      <QuickLink href={`/orders?q=${encodeURIComponent(m.merchantId)}`}>
                        訂單
                      </QuickLink>
                    </div>
                  </div>
                );
              })}
            </ResultGroup>
          ) : null}

          {results.products.length > 0 ? (
            <ResultGroup icon={Package} title="商品">
              {results.products.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.sku} · {p.productId}
                  </span>
                </Link>
              ))}
            </ResultGroup>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border/70 bg-background px-2 py-0.5 font-medium text-foreground/80 hover:border-primary/40 hover:text-primary"
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </Link>
  );
}

function ResultGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}
