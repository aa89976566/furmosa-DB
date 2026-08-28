'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Home, Recycle, Wallet, Warehouse } from 'lucide-react';
import { POS_NAV, activePosNavId, type PosNavId } from '@/lib/pos/pos-nav';
import type { PosAccount } from '@/lib/pos/account';
import { PosAccountMenu } from '@/components/pos/account-menu';
import { useRestockCart } from '@/components/pos/restock-cart-provider';

const ICONS: Record<PosNavId, typeof Home> = {
  home: Home,
  stock: Warehouse,
  refill: Recycle,
  records: ClipboardList,
  settle: Wallet,
};

function RestockBadge({ active }: { active: boolean }) {
  const { itemCount } = useRestockCart();
  if (itemCount <= 0) return null;
  return (
    <span
      className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        active ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
      }`}
    >
      {itemCount}
    </span>
  );
}

export function InventorySideNav({ account }: { account: PosAccount }) {
  const pathname = usePathname() || '/pos/stock';
  const active = activePosNavId(pathname);

  return (
    <aside className="hidden h-full w-[220px] shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
      <div className="px-5 pb-6 pt-6">
        <p className="text-lg font-semibold tracking-[0.18em] text-zinc-900">FURMOSA</p>
        <p className="mt-1 text-xs tracking-[0.14em] text-zinc-400">STORE POS</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="店家導航">
        {POS_NAV.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-neutral-100 hover:text-zinc-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{tab.label}</span>
              {tab.id === 'stock' ? <RestockBadge active={isActive} /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-neutral-200 px-3 py-4">
        <PosAccountMenu account={account} variant="store" />
      </div>
    </aside>
  );
}

export function InventoryBottomNav() {
  const pathname = usePathname() || '/pos/stock';
  const active = activePosNavId(pathname);
  const { itemCount } = useRestockCart();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="店家導航"
    >
      <div className="flex items-stretch">
        {POS_NAV.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-[56px] flex-1 items-center justify-center text-sm font-medium ${
                isActive ? 'text-zinc-900' : 'text-zinc-500'
              }`}
            >
              {isActive ? (
                <span className="rounded-full bg-zinc-900 px-3 py-2 text-white">{tab.label}</span>
              ) : (
                tab.label
              )}
              {tab.id === 'stock' && itemCount > 0 ? (
                <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold text-white">
                  {itemCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
