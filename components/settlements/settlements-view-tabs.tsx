'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

function buildHref(view: 'list' | 'create', searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams.toString());
  if (view === 'create') next.set('view', 'create');
  else next.delete('view');
  const q = next.toString();
  return q ? `/merchants/settlements?${q}` : '/merchants/settlements';
}

export function SettlementsViewTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCreate = searchParams.get('view') === 'create';
  const base = pathname.startsWith('/merchants/settlements')
    ? '/merchants/settlements'
    : '/merchants/settlements';

  const tabs = [
    { key: 'list' as const, label: '月結列表', active: !isCreate },
    { key: 'create' as const, label: '建立月結', active: isCreate },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={buildHref(tab.key, searchParams)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab.active
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
