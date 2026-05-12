'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

const WEIGHT_OPTIONS = [30, 50, 100, 150];

export function LookupForm({
  defaultQuery,
  defaultWeight,
  allProducts,
}: {
  defaultQuery: string;
  defaultWeight: number | null;
  allProducts: Array<{ id: string; name: string; sourceSku: string | null; sku: string }>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const [weight, setWeight] = useState<number | null>(defaultWeight);
  const [showSuggest, setShowSuggest] = useState(false);

  // 名稱 + SKU 自動建議（簡單前綴／包含搜尋）
  const suggestions = useMemo(() => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 1) return [];
    const lower = trimmed.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          p.name.includes(trimmed) ||
          (p.sourceSku?.toLowerCase().includes(lower) ?? false) ||
          p.sku.toLowerCase().includes(lower),
      )
      .slice(0, 8);
  }, [q, allProducts]);

  function submit(nextQ?: string, nextWeight?: number | null) {
    const finalQ = (nextQ ?? q).trim();
    const finalW = nextWeight !== undefined ? nextWeight : weight;
    const params = new URLSearchParams();
    if (finalQ) params.set('q', finalQ);
    if (finalW) params.set('weight', String(finalW));
    router.push(`/products/lookup${params.toString() ? `?${params}` : ''}`);
    setShowSuggest(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => {
              // 延遲關閉，讓 click 事件能觸發
              setTimeout(() => setShowSuggest(false), 150);
            }}
            placeholder="輸入商品名稱、單價表 SKU、系統 SKU..."
            className="block w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                submit('', weight);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {showSuggest && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-lg">
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQ(s.name);
                    submit(s.name, weight);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted"
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.sourceSku ?? s.sku}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <select
          value={weight ?? ''}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            setWeight(v);
            if (q.trim()) submit(q, v);
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">所有重量</option>
          {WEIGHT_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w}g
            </option>
          ))}
        </select>

        <Button type="submit">
          <Search className="mr-1 h-4 w-4" />
          搜尋
        </Button>
      </div>

      {/* 快選 chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">熱門搜尋：</span>
        {['雞肉', '鴨肉', '牛肉', '凍乾', '雞霸'].map((kw) => (
          <button
            key={kw}
            type="button"
            onClick={() => {
              setQ(kw);
              submit(kw, weight);
            }}
            className="rounded-full border px-2.5 py-0.5 hover:bg-muted"
          >
            {kw}
          </button>
        ))}
      </div>
    </form>
  );
}
