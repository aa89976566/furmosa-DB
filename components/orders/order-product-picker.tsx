'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { variationLabel } from '@/lib/product-variations';

export type OrderProductPickerTier = {
  id: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  notes: string | null;
};

export type OrderProductPickerOption = {
  id: string;
  name: string;
  imageUrl?: string | null;
  sku: string;
  availableStock: number;
  inventorySourceLabel?: string | null;
  price: number;
  unit: string;
  priceTiers: OrderProductPickerTier[];
};

function productSearchText(product: OrderProductPickerOption) {
  return `${product.name} ${product.sku}`.toLocaleLowerCase('zh-TW');
}

export function OrderProductPicker({
  products,
  onSearch,
  onPick,
  getUnitPrice,
  disabled = false,
}: {
  products: OrderProductPickerOption[];
  onSearch: (query: string) => Promise<OrderProductPickerOption[]>;
  onPick: (product: OrderProductPickerOption, tierId: string) => void;
  getUnitPrice: (product: OrderProductPickerOption, tierId: string) => number | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<OrderProductPickerOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (disabled || !query.trim()) return;
    let cancelled = false;
    setRemote(null);
    const timer = window.setTimeout(() => {
      setSearching(true);
      void onSearch(query)
        .then((rows) => { if (!cancelled) setRemote(rows); })
        .catch(() => { if (!cancelled) setRemote(null); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [onSearch, disabled, query]);

  const localMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-TW');
    if (!normalized) return products;
    return products.filter((product) => productSearchText(product).includes(normalized));
  }, [products, query]);
  const list = remote ?? localMatches;

  function pick(product: OrderProductPickerOption, tierId: string) {
    if (getUnitPrice(product, tierId) == null) return;
    onPick(product, tierId);
    setExpandedId(null);
    setQuery('');
    setRemote(null);
    setSearching(false);
    inputRef.current?.focus();
  }

  function priceLabel(product: OrderProductPickerOption, tierId: string) {
    const price = getUnitPrice(product, tierId);
    return price == null ? null : formatCurrency(price);
  }

  return (
    <section aria-label="加入商品" className="mb-4 space-y-2">
      <h2 className="text-sm font-semibold">加入商品</h2>
        {disabled ? (
          <div className="text-sm text-muted-foreground">
            請先選擇合作店家，再加入買斷商品。
          </div>
        ) : (
          <>
            <div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  aria-label="搜尋商品名稱或 SKU"
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === 'Enter') event.preventDefault();
                    const actions = resultsRef.current?.querySelectorAll('button');
                    if (event.key === 'ArrowDown' && actions?.length) {
                      event.preventDefault();
                      actions[0].focus();
                    }
                    if (event.key === 'Enter' && actions?.length === 1) actions[0].click();
                  }}
                  value={query}
                  onChange={(event) => {
                    setRemote(null);
                    setExpandedId(null);
                    setSearching(Boolean(event.target.value.trim()));
                    setQuery(event.target.value);
                  }}
                  placeholder="搜尋商品名稱或 SKU"
                  className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            {query.trim() ? <div ref={resultsRef} aria-live="polite"
              onKeyDown={(event) => {
                if (event.key === 'Escape') inputRef.current?.focus();
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                const actions = Array.from(event.currentTarget.querySelectorAll('button'));
                const index = actions.indexOf(event.target as HTMLButtonElement);
                if (index < 0) return;
                event.preventDefault();
                const next = index + (event.key === 'ArrowDown' ? 1 : -1);
                (actions[next] ?? inputRef.current)?.focus();
              }}>
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 搜尋商品中
                </div>
              ) : list.length === 0 ? (
                <div className="py-3 text-center text-sm text-muted-foreground">
                  找不到符合的商品
                </div>
              ) : (
                <div className="grid gap-2">
                  {list.map((product) => {
                    const needsTier = product.priceTiers.length > 1;
                    const onlyTier = product.priceTiers.length === 1 ? product.priceTiers[0] : null;
                    const expanded = expandedId === product.id;
                    return (
                      <article key={product.id} className="rounded-lg border bg-card px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-contain" /> : null}
                            <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{product.name}</h3>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{product.sku}</p>
                            </div>
                          </div>
                          <span className="max-w-[50%] rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {product.inventorySourceLabel ? `${product.inventorySourceLabel} ${product.inventorySourceLabel.startsWith('來源：') ? `${product.availableStock}g${onlyTier?.weightGrams ? ` · 可供應 ${Math.max(0, Math.floor(product.availableStock / onlyTier.weightGrams))} 罐` : ''}` : ''}` : `庫存 ${product.availableStock}`}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {needsTier ? null : priceLabel(product, onlyTier?.id ?? '')}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              {needsTier ? `${product.priceTiers.length} 種規格` : onlyTier ? variationLabel(onlyTier) : product.unit}
                            </span>
                          </p>
                          {needsTier ? (
                            <Button type="button" size="sm" variant="outline" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : product.id)}>
                              選規格
                            </Button>
                          ) : (
                            <Button type="button" size="sm" disabled={getUnitPrice(product, onlyTier?.id ?? '') == null} onClick={() => pick(product, onlyTier?.id ?? '')}>
                              <Plus className="mr-1 h-4 w-4" /> 加入
                            </Button>
                          )}
                        </div>
                        {needsTier && expanded ? (
                          <div className="mt-3 grid gap-2 border-t pt-3">
                            {product.priceTiers.map((tier) => (
                              <button
                                key={tier.id}
                                type="button"
                                disabled={getUnitPrice(product, tier.id) == null}
                                onClick={() => pick(product, tier.id)}
                                className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/5"
                              >
                                <span>{variationLabel(tier)}{tier.notes ? ` · ${tier.notes}` : ''}</span>
                                <span className="flex items-center gap-1 font-medium"><Check className="h-3.5 w-3.5" /> {priceLabel(product, tier.id)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div> : null}
          </>
        )}
    </section>
  );
}
