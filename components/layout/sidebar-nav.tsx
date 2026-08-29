'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { navGroups } from '@/lib/nav';
import { isNavItemActive } from '@/lib/nav-active';
import { sectionToneStyles } from '@/lib/section-tone';
import { cn } from '@/lib/utils';

/** 高頻工作台：允許 RSC prefetch，其餘關閉以免拖慢側欄 */
const HOT_PREFETCH = new Set([
  '/dashboard',
  '/orders',
  '/shipments',
  '/merchants',
  '/customers',
  '/products',
]);

export function SidebarNav({
  badges = {},
}: {
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="space-y-6">
      {navGroups.map((group) => {
        const groupStyles = sectionToneStyles[group.tone];
        return (
          <div key={group.label}>
            <p
              className={cn(
                'mb-2 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                groupStyles.chip,
              )}
            >
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, searchParams, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={HOT_PREFETCH.has(item.href)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                      active
                        ? cn('font-medium text-navy shadow-sm ring-1', groupStyles.sidebarActive)
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        active ? groupStyles.eyebrow : 'text-muted-foreground',
                      )}
                    />
                    <span>{item.label}</span>
                    {(badges[item.href] ?? 0) > 0 ? (
                      <span
                        className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
                        aria-label={`${badges[item.href]} 筆待處理`}
                      >
                        {badges[item.href]}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
