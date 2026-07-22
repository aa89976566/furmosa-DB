'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/pos', label: '今天', match: (p: string) => p === '/pos' },
  {
    href: '/pos/restock',
    label: '叫貨',
    match: (p: string) => p === '/pos/restock' || p.startsWith('/pos/restock/'),
  },
  {
    href: '/pos/records',
    label: '紀錄',
    match: (p: string) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
] as const;

export function PosBottomNav() {
  const pathname = usePathname() || '/pos';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur"
      aria-label="店家導航"
    >
      <div className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center text-sm font-medium ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
