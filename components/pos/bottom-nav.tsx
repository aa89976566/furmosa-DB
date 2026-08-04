'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, PackagePlus, Sun } from 'lucide-react';

const TABS = [
  {
    href: '/pos',
    label: '今天',
    icon: Sun,
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/90 backdrop-blur-md"
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
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium tracking-wide transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? 'stroke-[2.25]' : 'stroke-[1.75] opacity-80'}`}
                aria-hidden
              />
              <span>{tab.label}</span>
              <span
                className={`mt-0.5 h-0.5 w-5 rounded-full transition-opacity ${
                  active ? 'bg-primary opacity-100' : 'opacity-0'
                }`}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
