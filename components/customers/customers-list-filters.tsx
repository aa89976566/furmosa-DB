'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';

export function CustomersListFilters({
  q,
  filter,
  shown,
  total,
}: {
  q: string;
  filter: string;
  shown: number;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (patch: { filter?: string | null; q?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (patch.filter === null || patch.filter === undefined) params.delete('filter');
    else if (patch.filter) params.set('filter', patch.filter);
    if (patch.q === null) params.delete('q');
    else if (patch.q !== undefined) {
      if (patch.q) params.set('q', patch.q);
      else params.delete('q');
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2 text-sm text-muted-foreground">
      <span>
        顯示 <strong className="text-foreground">{shown}</strong> / {total} 筆
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
      {filter ? (
        <Link
          href={buildHref({ filter: null })}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
        >
          篩選：{filter === 'loyalty' ? '換罐會員' : '訂閱中'}
          <X className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}
