'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/pos',
    label: '工作台',
    match: (p: string) => p === '/pos' || p.startsWith('/pos/appointments'),
  },
  {
    href: '/pos/refill',
    label: '換罐',
    match: (p: string) => p === '/pos/refill' || p.startsWith('/pos/refill/'),
  },
  {
    href: '/pos/restock',
    label: '補貨',
    match: (p: string) => p === '/pos/restock' || p.startsWith('/pos/restock/'),
  },
  {
    href: '/pos/records',
    label: '紀錄',
    match: (p: string) =>
      p === '/pos/records' ||
      p.startsWith('/pos/records/') ||
      p.startsWith('/pos/sales') ||
      p.startsWith('/pos/settlements'),
  },
] as const;

export function PosBottomNav() {
  const pathname = usePathname() || '/pos';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7e5e4] bg-white/95 backdrop-blur"
      aria-label="店家導航"
    >
      <div className="mx-auto flex max-w-5xl">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[56px] flex-1 items-center justify-center border-t-2 text-sm font-medium transition ${
                active
                  ? 'border-[#191919] text-[#191919]'
                  : 'border-transparent text-[#6b6b6b] hover:text-[#191919]'
              }`}
              aria-current={active ? 'page' : undefined}
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
