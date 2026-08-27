'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Package,
} from 'lucide-react';
import { POS_NAV, activePosNavId, type PosNavId } from '@/lib/pos/pos-nav';
import { posLogoutAction } from '@/app/pos/actions';

const ICONS: Record<PosNavId, typeof LayoutGrid> = {
  sell: LayoutGrid,
  today: CalendarDays,
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
      <div className="mx-auto flex max-w-lg">
        {POS_NAV.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
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
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          F
        </div>
        <div className="mt-8 flex flex-1 flex-col items-center gap-2">
          {POS_NAV.map((tab) => {
            const Icon = ICONS[tab.id];
            const isActive = active === tab.id;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  isActive
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
        <form action={posLogoutAction}>
          <button
            type="submit"
            title="登出"
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span className="sr-only">登出</span>
          </button>
        </form>
      </nav>
    </aside>
  );
}
