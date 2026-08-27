'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { stockStatus, type StockTone } from '@/lib/pos/stock-status';

export type StockListItem = {
  productId: string;
  name: string;
  quantity: number;
};

const TONE_CLASS: Record<StockTone, string> = {
  sold_out: 'text-destructive',
  low: 'text-amber-700',
  ok: 'text-muted-foreground',
};

export function StockList({
  items,
  initialFilter = 'all',
}: {
  items: StockListItem[];
  initialFilter?: 'all' | 'low';
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>(initialFilter);

  const visible = useMemo(() => {
    const q = query.trim();
    return items.filter((item) => {
      const status = stockStatus(item.quantity);
      if (filter === 'low' && status.tone === 'ok') return false;
      if (q && !item.name.includes(q)) return false;
      return true;
    });
  }, [items, query, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋商品"
          className="h-12 rounded-full border-0 bg-card pl-10 shadow-card"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={`min-h-[40px] rounded-full px-4 text-sm font-medium ${
            filter === 'all' ? 'bg-navy text-white' : 'bg-card text-muted-foreground'
          }`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button
          type="button"
          className={`min-h-[40px] rounded-full px-4 text-sm font-medium ${
            filter === 'low' ? 'bg-navy text-white' : 'bg-card text-muted-foreground'
          }`}
          onClick={() => setFilter('low')}
        >
          庫存不足
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">沒有符合的商品。</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            const status = stockStatus(item.quantity);
            return (
              <li key={item.productId} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-navy">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">庫存 {item.quantity}</p>
                  </div>
                  {status.tone !== 'ok' ? (
                    <span className={`text-sm font-medium ${TONE_CLASS[status.tone]}`}>
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{status.label}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
