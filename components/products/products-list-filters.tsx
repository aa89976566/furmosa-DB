'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'active', label: '上架' },
  { key: 'inactive', label: '下架' },
  { key: 'draft', label: '草稿' },
] as const;

export function ProductsListFilters({
  total,
  activeCount,
  q,
  status,
}: {
  total: number;
  activeCount: number;
  q: string;
  status: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (patch: { q?: string | null; status?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (patch.q === null) params.delete('q');
    else if (patch.q !== undefined) {
      if (patch.q) params.set('q', patch.q);
      else params.delete('q');
    }
    if (patch.status === null || patch.status === '') params.delete('status');
    else if (patch.status !== undefined) params.set('status', patch.status);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key || 'all'}
            href={buildHref({ status: tab.key || null })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              (status || '') === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          顯示 <strong className="text-foreground">{total}</strong> 筆
          {!status && !q ? (
            <span className="ml-1">（上架 {activeCount}）</span>
          ) : null}
        </span>
        {q ? (
          <Link
            href={buildHref({ q: null })}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
          >
            搜尋：{q}
            <X className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
