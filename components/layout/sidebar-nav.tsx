'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { navGroups } from '@/lib/nav';
import { isNavItemActive } from '@/lib/nav-active';
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

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="space-y-7">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[11px] font-medium tracking-wide text-white/40">
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
                  prefetch={HOT_PREFETCH.has(item.href)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/12 font-medium text-white'
                      : 'text-white/65 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      active ? 'text-yellow' : 'text-white/45',
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
