'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋訂單、商品、罐子序號"
          className="h-12 rounded-full border-0 bg-card pl-10 shadow-card"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="查詢分類">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-medium ${
              kind === tab.id ? 'bg-navy text-white' : 'bg-card text-muted-foreground'
            }`}
            onClick={() => setKind(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">沒有符合的資料。</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block">
                <Card className="shadow-card">
                  <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatQueryWhen(item.at)}</p>
                      <p className="truncate font-medium text-navy">{item.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-sm text-primary">{item.status}</span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
