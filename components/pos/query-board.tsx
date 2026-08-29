'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  filterQueryFeed,
  formatQueryWhen,
  type QueryFeedItem,
  type QueryKind,
} from '@/lib/pos/query-feed';

const TABS: { id: QueryKind | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'sale', label: '銷售' },
  { id: 'refill', label: '換罐' },
  { id: 'restock', label: '補貨' },
  { id: 'stock', label: '庫存' },
];

export function QueryBoard({ items }: { items: QueryFeedItem[] }) {
  const [kind, setKind] = useState<QueryKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterQueryFeed(items, kind, query), [items, kind, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋訂單、商品、罐子序號"
          className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-zinc-400"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="查詢分類">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            className={`min-h-[38px] shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
              kind === tab.id
                ? 'bg-zinc-900 text-white'
                : 'border border-neutral-200 bg-white text-zinc-500 hover:text-zinc-900'
            }`}
            onClick={() => setKind(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-zinc-500">
          沒有符合的資料。
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {visible.map((item, index) => (
            <li key={item.id} className={index === 0 ? '' : 'border-t border-neutral-100'}>
              <Link
                href={item.href}
                className="flex min-h-[76px] items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-neutral-50 md:px-5"
              >
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400">{formatQueryWhen(item.at)}</p>
                  <p className="mt-0.5 truncate font-medium text-zinc-900">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm text-zinc-500">{item.subtitle}</p>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                  {item.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
