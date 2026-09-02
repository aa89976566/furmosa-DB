'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { navGroups } from '@/lib/nav';
import { isNavItemActive } from '@/lib/nav-active';
import { sectionToneStyles } from '@/lib/section-tone';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

/** 高頻工作台：允許 RSC prefetch，其餘關閉以免拖慢側欄 */
const HOT_PREFETCH = new Set([
  '/dashboard',
  '/orders',
  '/reviews',
  '/shipments',
  '/merchants',
  '/customers',
  '/products',
  '/inventory',
]);

export function SidebarNav({
  itemExtras,
}: {
  itemExtras?: Partial<Record<string, ReactNode>>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="space-y-4">
      {navGroups.map((group) => {
        const groupStyles = sectionToneStyles[group.tone];
        const hasActiveItem = group.items.some((item) =>
          isNavItemActive(pathname, searchParams, item.href),
        );
        const items = (
          <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, searchParams, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={HOT_PREFETCH.has(item.href)}
                    className={cn(
                      'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? cn('bg-muted font-semibold text-foreground', groupStyles.sidebarActive)
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        active ? groupStyles.eyebrow : 'text-muted-foreground',
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {itemExtras?.[item.href]}
                  </Link>
                );
              })}
          </div>
        );

        if (group.collapsible) {
          return (
            <details key={group.label} className="group" open={hasActiveItem || undefined}>
              <summary className="mb-1 flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span>{group.label}</span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              {items}
            </details>
          );
        }

        return (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[11px] font-medium tracking-wide text-muted-foreground">
              {group.label}
            </p>
            {items}
          </div>
        );
      })}
    </nav>
  );
}
