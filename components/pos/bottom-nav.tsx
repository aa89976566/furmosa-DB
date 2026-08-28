'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

export function PosBottomNav() {
  const pathname = usePathname() || '/pos/stock';
  const active = activePosNavId(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="店家導航"
    >
      <div className="grid grid-cols-4">
        {POS_NAV.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className="flex min-h-[60px] items-center justify-center px-1 text-sm font-medium"
            >
              <span
                className={`rounded-full px-3 py-2 transition-colors ${
                  isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

export function PosSideRail({ storeName }: { storeName?: string }) {
  const pathname = usePathname() || '/pos/stock';
  const active = activePosNavId(pathname);

  return (
    <aside className="hidden h-full w-[220px] shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
      <div className="px-5 pb-6 pt-6">
        <Link href="/pos/stock" className="block" aria-label="回到庫存">
          <p className="text-lg font-semibold tracking-[0.18em] text-zinc-900">FURMOSA</p>
          <p className="text-sm font-medium text-zinc-900">匠寵</p>
          <p className="mt-0.5 text-xs tracking-[0.14em] text-zinc-400">STORE POS</p>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="店家導航">
        {POS_NAV.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-neutral-100 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {storeName ? (
        <div className="border-t border-neutral-200 px-4 py-4">
          <p className="truncate text-xs text-zinc-500">{storeName}</p>
        </div>
      ) : null}
    </aside>
  );
}
