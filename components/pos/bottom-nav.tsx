'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Home, PackagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  {
    href: '/pos',
    label: '今天',
    icon: Home,
    match: (p: string) => p === '/pos',
  },
  {
    href: '/pos/restock',
    label: '叫貨',
    icon: PackagePlus,
    match: (p: string) => p === '/pos/restock' || p.startsWith('/pos/restock/'),
  },
  {
    href: '/pos/records',
    label: '紀錄',
    icon: ClipboardList,
    match: (p: string) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
] as const;

export function PosBottomNav() {
  const pathname = usePathname() || '/pos';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 backdrop-blur-md"
      aria-label="店家導航"
    >
      <div className="mx-auto flex max-w-lg px-2 pt-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold tracking-wide transition-colors duration-200',
                active ? 'text-coral' : 'text-muted-foreground hover:text-navy',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                  active ? 'bg-coral/12 scale-105' : 'bg-transparent',
                )}
              >
                <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.4 : 2} />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
