"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POS_NAV, activePosNavId } from "@/lib/pos/pos-nav";
import { Archive, ClipboardList, Home, RefreshCw, Scissors, WalletCards } from "lucide-react";

const NAV_ICONS = { home: Home, stock: Archive, refill: RefreshCw, coupons: Scissors, records: ClipboardList, settle: WalletCards };

function navItemClass(isActive: boolean) {
  return isActive
    ? "bg-primary text-primary-foreground"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";
}

export function PosBottomNav() {
  const pathname = usePathname() || "/pos";
  const active = activePosNavId(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-foreground bg-card md:hidden"
      aria-label="店家導航"
    >
      <div className="mx-auto flex max-w-lg items-end">
        {POS_NAV.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[60px] flex-1 items-center justify-center border-r border-border px-1 text-sm font-medium last:border-r-0 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
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

export function PosSideRail({ storeName, expanded = false }: { storeName?: string; expanded?: boolean }) {
  const pathname = usePathname() || "/pos";
  const active = activePosNavId(pathname);

  return (
    <aside className={`hidden md:flex md:flex-col ${expanded ? 'md:items-stretch' : 'md:items-center'} md:py-5`}>
      <nav
        className={expanded ? "flex h-full w-full flex-col border-r border-border bg-card px-4 py-5" : "flex h-full w-[104px] flex-col items-center rounded-[28px] border-2 border-foreground bg-card py-5 shadow-card"}
        aria-label="店家導航"
      >
        {expanded ? <div className="border-b border-border px-2 pb-5"><p className="text-2xl font-black tracking-tight text-primary">FURMOSA</p><p className="text-base font-bold text-primary">匠寵</p>{storeName ? <div className="mt-5"><p className="text-xs text-muted-foreground">店家收銀</p><p className="mt-1 truncate font-semibold">{storeName}</p></div> : null}</div> : null}
        <div className={`${expanded ? 'mt-4 px-0' : 'mt-1 px-2'} flex w-full flex-1 flex-col items-stretch gap-1`}>
          {POS_NAV.map((tab) => {
            const isActive = active === tab.id;
            const Icon = NAV_ICONS[tab.id];
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[48px] items-center ${expanded ? 'justify-start gap-3 px-4 text-base' : 'justify-center text-sm'} rounded-xl font-medium leading-none ${navItemClass(isActive)}`}
              >
                {expanded ? <Icon className="h-5 w-5 shrink-0" /> : null}{tab.label}
              </Link>
            );
          })}
        </div>
        {!expanded && storeName ? (
          <p className="mb-3 max-w-[80px] truncate px-1 text-center text-[10px] text-muted-foreground">
            {storeName}
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
