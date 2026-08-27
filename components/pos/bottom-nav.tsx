'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, LayoutGrid, Package, Recycle, Warehouse } from 'lucide-react';
import { POS_NAV, activePosNavId, type PosNavId } from '@/lib/pos/pos-nav';

const ICONS: Record<PosNavId, typeof LayoutGrid> = {
  sell: LayoutGrid,
  stock: Warehouse,
  refill: Recycle,
  restock: Package,
  records: ClipboardList,
};

export function PosBottomNav() {
  const pathname = usePathname() || '/pos';
  const active = activePosNavId(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur md:hidden"
      aria-label="店家導航"
    >
      <div className="mx-auto flex max-w-lg items-end">
        {POS_NAV.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = active === tab.id;
          const isRefill = tab.id === 'refill';
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isRefill ? '-mt-3' : ''
              } ${isActive || isRefill ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <span
                className={
                  isRefill
                    ? `flex h-14 w-14 items-center justify-center rounded-full shadow-card ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/90 text-primary-foreground'
                      }`
                    : 'flex h-6 w-6 items-center justify-center'
                }
              >
                <Icon className={isRefill ? 'h-6 w-6' : 'h-4 w-4'} aria-hidden />
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

export function PosSideRail({ storeName }: { storeName?: string }) {
  const pathname = usePathname() || '/pos';
  const active = activePosNavId(pathname);

  return (
    <aside className="hidden md:flex md:flex-col md:items-center md:py-5">
      <nav
        className="flex h-full w-[72px] flex-col items-center rounded-[28px] bg-card py-5 shadow-card"
        aria-label="店家導航"
      >
        <Link
          href="/pos"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          title="回首頁"
        >
          F
          <span className="sr-only">回首頁</span>
        </Link>
        <div className="mt-6 flex flex-1 flex-col items-center gap-2">
          {POS_NAV.map((tab) => {
            const Icon = ICONS[tab.id];
            const isActive = active === tab.id;
            const isRefill = tab.id === 'refill';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  isRefill
                    ? isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/15 text-primary'
                    : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{tab.label}</span>
              </Link>
            );
          })}
        </div>
        {storeName ? (
          <p className="mb-3 max-w-[64px] truncate text-center text-[10px] text-muted-foreground">
            {storeName}
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
