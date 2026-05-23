'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutGrid, Receipt, ScrollText } from 'lucide-react';

const TABS: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
}[] = [
  { href: '/merchants', label: '總覽', icon: LayoutGrid, exact: true },
  { href: '/merchants/stock', label: '庫存紀錄', icon: ScrollText },
  { href: '/merchants/settlements', label: '月結紀錄', icon: Receipt },
];

function isTabActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MerchantsHubTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border/60 bg-surface-raised px-6">
      <ul className="-mb-px flex flex-wrap gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href, tab.exact);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
