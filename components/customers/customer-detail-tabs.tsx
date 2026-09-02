'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CustomerDetailTab = {
  value: string;
  label: string;
  content: ReactNode;
};

export function CustomerDetailTabs({ items }: { items: CustomerDetailTab[] }) {
  const [active, setActive] = useState(items[0]?.value ?? '');
  const selected = items.find((item) => item.value === active) ?? items[0];

  return (
    <div>
      <div
        className="flex flex-wrap gap-x-1 border-b border-border"
        role="tablist"
        aria-label="會員資料檢視"
      >
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active === item.value}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              active === item.value
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActive(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="pt-4" role="tabpanel">
        {selected?.content}
      </div>
    </div>
  );
}
