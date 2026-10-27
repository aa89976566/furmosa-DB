'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
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
  price: number;
  unit: string;
  priceTiers: OrderProductPickerTier[];
};

function productSearchText(product: OrderProductPickerOption) {
  return `${product.name} ${product.sku}`.toLocaleLowerCase('zh-TW');
}

export function OrderProductPicker({
  open,
  onOpenChange,
  products,
  onSearch,
  onPick,
  disabled = false,
  embedded = false,
}: {
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: OrderProductPickerOption[];
  onSearch: (query: string) => Promise<OrderProductPickerOption[]>;
  onPick: (product: OrderProductPickerOption, tierId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<OrderProductPickerOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void onSearch(query)
        .then((result) => { if (active) setRemote(result); })
        .catch(() => { if (active) setRemote([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [onSearch, open, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setRemote(null);
      setExpandedId(null);
    }
  }, [open]);

  const localMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-TW');
    if (!normalized) return products;
    return products.filter((product) => productSearchText(product).includes(normalized));
  }, [products, query]);
  const list = remote ?? localMatches;

  function pick(product: OrderProductPickerOption, tierId: string) {
    onPick(product, tierId);
    setExpandedId(null);
    setQuery('');
    setRemote(null);
  }

  if (!open) return null;

  return (
    <div className={embedded ? "mt-6 border-t pt-5" : "fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"}>
      {!embedded ? <button
        type="button"
        aria-label="關閉商品選擇器"
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      /> : null}
      <section
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label="加入商品"
        className={embedded ? "flex min-w-0 flex-col" : "relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:rounded-2xl"}
      >
        <header className={embedded ? "flex items-center justify-between pb-3" : "flex items-center justify-between border-b px-5 py-4"}>
          <div>
            <h2 className="text-lg font-semibold">{embedded ? '選擇商品' : '加入商品'}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              搜尋商品，選擇規格後直接加入此訂單
            </p>
          </div>
          {!embedded ? <Button type="button" size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">關閉</span>
          </Button> : null}
        </header>

        {disabled ? (
          <div className="m-5 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            請先選擇合作店家，再加入批發商品。
          </div>
        ) : (
          <>
            <div className={embedded ? "pb-3" : "border-b p-4"}>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus={!embedded}
                  aria-label="搜尋商品名稱或 SKU"
                  onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜尋商品名稱或 SKU"
                  className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            <div className={embedded ? "max-h-[480px] overflow-y-auto overscroll-contain" : "min-h-0 flex-1 overflow-y-auto p-4"}>
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 搜尋商品中
                </div>
              ) : list.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  找不到符合的商品
                </div>
              ) : (
                <div className={embedded ? "divide-y" : "grid gap-3 sm:grid-cols-2"}>
                  {list.map((product) => {
                    const needsTier = product.priceTiers.length > 1;
                    const onlyTier = product.priceTiers.length === 1 ? product.priceTiers[0] : null;
                    const expanded = expandedId === product.id;
                    return (
                      <article key={product.id} className={embedded ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3" : "rounded-xl border bg-card p-4"}>
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-contain" /> : <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#eaf1ea] text-sm font-semibold text-[#245744]">{product.name.replace(/[◈◆｜]/g, '').trim().slice(0, 2)}</span>}
                            <div className="min-w-0">
                            <h3 className="text-sm font-semibold">{product.name}</h3>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{onlyTier ? variationLabel(onlyTier) : product.sku} · 庫存 {product.availableStock} {product.unit}{product.availableStock <= 0 ? ' · 目前無現貨' : ''}</p>
                            </div>
                          </div>
                          <span className={embedded ? "hidden" : "shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground"}>
                            庫存 {product.availableStock}
                          </span>
                        </div>
                        <div className={embedded ? "flex items-center gap-3" : "mt-4 flex items-center justify-between gap-3"}>
                          <p className={embedded ? "hidden" : "text-sm font-medium"}>
                            {onlyTier ? formatCurrency(onlyTier.price) : formatCurrency(product.price)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              / {onlyTier ? variationLabel(onlyTier) : product.unit}
                            </span>
                          </p>
                          {needsTier ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => setExpandedId(expanded ? null : product.id)}>
                              選規格
                            </Button>
                          ) : (
                            <Button type="button" size="sm" className={embedded ? "bg-[#245744] text-white hover:bg-[#1b4435]" : undefined} onClick={() => pick(product, onlyTier?.id ?? '')}>
                              <Plus className="mr-1 h-4 w-4" /> 加入
                            </Button>
                          )}
                        </div>
                        {needsTier && expanded ? (
                          <div className="col-span-full mt-3 grid gap-2 border-t pt-3">
                            {product.priceTiers.map((tier) => (
                              <button
                                key={tier.id}
                                type="button"
                                onClick={() => pick(product, tier.id)}
                                className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/5"
                              >
                                <span>{variationLabel(tier)}{tier.notes ? ` · ${tier.notes}` : ''}</span>
                                <span className="flex items-center gap-1 font-medium"><Check className="h-3.5 w-3.5" /> {formatCurrency(tier.price)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
