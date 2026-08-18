'use client';

import { DIALOG_NAV_LABEL, TABS } from '@/lib/merchant-pos-preview/copy';
import type { TabId } from '@/lib/merchant-pos-preview/types';

const ITEMS: Array<{ id: TabId; label: string }> = [
  { id: 'checkout', label: TABS.checkout },
  { id: 'sales', label: TABS.sales },
  { id: 'restock', label: TABS.restock },
  { id: 'more', label: TABS.more },
];

export function PreviewBottomNav({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (next: TabId) => void;
}) {
  return (
    <nav
      className="sticky bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur"
      aria-label={DIALOG_NAV_LABEL}
    >
      <div className="flex">
        {ITEMS.map((item) => {
          const current = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex min-h-[52px] min-w-[44px] flex-1 items-center justify-center px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                current ? 'text-primary' : 'text-muted-foreground'
              }`}
              aria-current={current ? 'page' : undefined}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
