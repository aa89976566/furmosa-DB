'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { navGroups } from '@/lib/nav';
import { isNavItemActive } from '@/lib/nav-active';
import { sectionToneStyles } from '@/lib/section-tone';
import { cn } from '@/lib/utils';

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="space-y-5">
      {navGroups.map((group) => {
        const groupStyles = sectionToneStyles[group.tone];
        return (
          <div key={group.label}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, searchParams, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-linear',
                      active
                        ? cn('font-medium ring-1', groupStyles.sidebarActive)
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-linear',
                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
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
