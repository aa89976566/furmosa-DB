'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

function navItemClass(isActive: boolean, isRefill: boolean) {
  if (isRefill) {
    return isActive
      ? 'bg-primary text-primary-foreground'
      : 'bg-primary/15 text-primary';
  }
  return isActive
    ? 'bg-primary text-primary-foreground'
    : 'text-muted-foreground hover:bg-muted hover:text-foreground';
}

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
          const isActive = active === tab.id;
          const isRefill = tab.id === 'refill';
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] flex-1 items-center justify-center text-sm font-medium ${
                isRefill ? '-mt-3' : ''
              } ${isActive || isRefill ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {isRefill ? (
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold shadow-card ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              ) : (
                tab.label
              )}
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
        className="flex h-full w-[96px] flex-col items-center rounded-[28px] bg-card py-5 shadow-card"
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
        <div className="mt-6 flex w-full flex-1 flex-col items-stretch gap-1 px-2">
          {POS_NAV.map((tab) => {
            const isActive = active === tab.id;
            const isRefill = tab.id === 'refill';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[48px] items-center justify-center text-sm font-medium leading-none ${
                  isRefill ? 'mx-auto h-14 w-14 rounded-full' : 'rounded-2xl'
                } ${navItemClass(isActive, isRefill)}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {storeName ? (
          <p className="mb-3 max-w-[80px] truncate px-1 text-center text-[10px] text-muted-foreground">
            {storeName}
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
