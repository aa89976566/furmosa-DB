'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, House, Recycle, Wallet, Warehouse } from 'lucide-react';
import { posLogoutAction } from '@/app/pos/actions';
import { POS_NAV, activePosNavId, type PosNavId } from '@/lib/pos/pos-nav';
import type { PosAccount } from '@/lib/pos/account';
import { storeHeading } from '@/lib/pos/store-display';
import { PosAccountMenu } from '@/components/pos/account-menu';
import { useOptionalRestockCartItemCount } from '@/components/pos/restock-cart-provider';

const ICONS: Record<PosNavId, typeof Warehouse> = {
  home: House,
  stock: Warehouse,
  refill: Recycle,
  records: ClipboardList,
  settle: Wallet,
};

const NAV_LINK_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2';

function RestockBadge({ active }: { active: boolean }) {
  const itemCount = useOptionalRestockCartItemCount();
  if (itemCount <= 0) return null;
  return (
    <span
      className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        active ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
      }`}
    >
      {itemCount}
      <span className="sr-only"> 件待補貨</span>
    </span>
  );
}

function BrandMark() {
  return (
    <Link
      href="/pos"
      className={`block rounded-xl ${NAV_LINK_FOCUS}`}
      aria-label="匠寵店家首頁"
    >
      <span className="flex items-center gap-3">
        <img
          src="/icons/icon.svg"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-xl"
        />
        <span>
          <span className="block text-lg font-semibold tracking-tight text-zinc-900">匠寵</span>
          <span className="block text-sm text-zinc-500">店家作業</span>
        </span>
      </span>
    </Link>
  );
}

export function InventorySideNav({
  account,
  storeName,
}: {
  account?: PosAccount | null;
  storeName?: string;
}) {
  const pathname = usePathname() || '/pos';
  const active = activePosNavId(pathname);
  const heading = storeHeading({
    name: account?.storeName ?? storeName ?? '',
    city: account?.storeCity,
  });
  const displayStore = heading.combined || storeName || '';

  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
      <div className="px-5 pb-4 pt-6">
        <BrandMark />
        {displayStore ? (
          <p className="mt-4 truncate text-sm font-medium text-zinc-900" title={displayStore}>
            {displayStore}
          </p>
        ) : null}
        {account ? (
          <p className="truncate text-sm text-zinc-500" title={account.staffName}>
            {account.staffName}
            {account.username ? `（${account.username}）` : ''}
          </p>
        ) : null}
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="店家導航">
        {POS_NAV.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-base font-medium ${NAV_LINK_FOCUS} ${
                isActive
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-700 hover:bg-neutral-100 hover:text-zinc-900'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span>{tab.label}</span>
              {tab.id === 'stock' ? <RestockBadge active={isActive} /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 border-t border-neutral-200 px-3 py-4">
        {account ? <PosAccountMenu account={account} variant="store" /> : null}
        <form action={posLogoutAction}>
          <button
            type="submit"
            className={`flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50 ${NAV_LINK_FOCUS}`}
          >
            登出
          </button>
        </form>
      </div>
    </aside>
  );
}

export function InventoryBottomNav() {
  const pathname = usePathname() || '/pos';
  const active = activePosNavId(pathname);
  const itemCount = useOptionalRestockCartItemCount();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="店家導航"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${POS_NAV.length}, minmax(0, 1fr))` }}
      >
        {POS_NAV.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[13px] font-medium leading-tight ${NAV_LINK_FOCUS} ${
                isActive ? 'text-zinc-900' : 'text-zinc-500'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span>{tab.label}</span>
              {isActive ? (
                <span className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-zinc-900" aria-hidden />
              ) : null}
              {tab.id === 'stock' && itemCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold text-white">
                  {itemCount}
                  <span className="sr-only"> 件待補貨</span>
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

/** 與桌機側欄共用同一份 POS_NAV；保留舊名稱給既有 import。 */
export const PosSideRail = InventorySideNav;
export const PosBottomNav = InventoryBottomNav;
