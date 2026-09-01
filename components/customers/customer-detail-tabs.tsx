'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function CustomerDetailTabs({
  overview,
  activity,
}: {
  overview: ReactNode;
  activity: ReactNode;
}) {
  const [tab, setTab] = useState<'overview' | 'activity'>('overview');

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-border" role="tablist" aria-label="會員資料檢視">
        {[
          ['overview', '總覽'],
          ['activity', '最近活動'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === value
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(value as 'overview' | 'activity')}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === 'overview' ? overview : activity}</div>
    </div>
  );
}
