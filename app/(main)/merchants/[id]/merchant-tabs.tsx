'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Tab = {
  href: string;
  label: string;
  badge?: number | string;
};

export function MerchantTabs({ merchantId, tabs }: { merchantId: string; tabs: Tab[] }) {
  const pathname = usePathname();
  const base = `/merchants/${merchantId}`;

  return (
    <nav className="border-b bg-background px-6">
      <ul className="-mb-px flex flex-wrap gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const href = t.href === '' ? base : `${base}/${t.href}`;
          const isActive =
            t.href === ''
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={t.href}>
              <Link
                href={href}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {t.badge != null && t.badge !== 0 && (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
