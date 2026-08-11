'use client';

import Link from 'next/link';
import { useCallback, useRef, type KeyboardEvent } from 'react';
import {
  MORNING_DASHBOARD_TAB_LABELS,
  MORNING_DASHBOARD_TABS,
  morningDashboardHref,
  type MorningDashboardTab,
} from '@/lib/line/morning/hq';
import { cn } from '@/lib/utils';

export function MorningDashboardTabNav({
  activeTab,
}: {
  activeTab: MorningDashboardTab;
}) {
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);

  const focusTab = useCallback((index: number) => {
    const el = refs.current[index];
    el?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const current = MORNING_DASHBOARD_TABS.indexOf(activeTab);
      if (current < 0) return;
      let next = current;
      if (event.key === 'ArrowRight') {
        next = (current + 1) % MORNING_DASHBOARD_TABS.length;
      } else if (event.key === 'ArrowLeft') {
        next = (current - 1 + MORNING_DASHBOARD_TABS.length) % MORNING_DASHBOARD_TABS.length;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = MORNING_DASHBOARD_TABS.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      focusTab(next);
      refs.current[next]?.click();
    },
    [activeTab, focusTab],
  );

  return (
    <div
      role="tablist"
      aria-label="壽司匠早安區塊"
      onKeyDown={onKeyDown}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
    >
      {MORNING_DASHBOARD_TABS.map((tab, index) => {
        const selected = tab === activeTab;
        return (
          <Link
            key={tab}
            href={morningDashboardHref(tab)}
            role="tab"
            id={`morning-tab-${tab}`}
            aria-selected={selected}
            aria-controls={`morning-panel-${tab}`}
            tabIndex={selected ? 0 : -1}
            ref={(el) => {
              refs.current[index] = el;
            }}
            className={cn(
              'shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'bg-foreground text-background'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {MORNING_DASHBOARD_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}
