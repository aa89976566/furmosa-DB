"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POS_NAV, activePosNavId } from "@/lib/pos/pos-nav";
import { Box, Home, ReceiptText, RefreshCcw, Search } from "lucide-react";

const NAV_ICONS = {
  home: Home,
  stock: Box,
  refill: RefreshCcw,
  records: Search,
  settle: ReceiptText,
};

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

export function PosSideRail({ storeName }: { storeName?: string }) {
  const pathname = usePathname() || "/pos";
  const active = activePosNavId(pathname);

  return (
    <aside className="hidden border-r bg-card md:flex md:h-screen md:flex-col">
      <nav
        className="flex h-full w-full flex-col"
        aria-label="店家導航"
      >
        <Link
          href="/pos"
          className="flex h-[98px] items-center border-b px-7 text-xl font-semibold tracking-[0.12em] text-foreground"
          title="回首頁"
        >
          FURMOSA<span className="sr-only">回首頁</span>
        </Link>
        <div className="flex w-full flex-1 flex-col gap-2 px-4 py-6">
          {POS_NAV.map((tab) => {
            const isActive = active === tab.id;
            const Icon = NAV_ICONS[tab.id];
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[52px] items-center gap-3 rounded-xl px-4 text-sm font-medium leading-none ${navItemClass(isActive)}`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
        {storeName ? (
          <p className="mx-4 mb-5 truncate rounded-xl border px-4 py-4 text-sm text-muted-foreground">
            {storeName}
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
