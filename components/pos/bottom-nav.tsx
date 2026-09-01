"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POS_NAV, activePosNavId } from "@/lib/pos/pos-nav";

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
    <aside className="hidden md:flex md:flex-col md:items-center md:py-5">
      <nav
        className="flex h-full w-[104px] flex-col items-center rounded-[28px] border-2 border-foreground bg-card py-5 shadow-card"
        aria-label="店家導航"
      >
        <Link
          href="/pos"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          title="回首頁"
        >
          F<span className="sr-only">回首頁</span>
        </Link>
        <div className="mt-6 flex w-full flex-1 flex-col items-stretch gap-1 px-2">
          {POS_NAV.map((tab) => {
            const isActive = active === tab.id;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[48px] items-center justify-center rounded-xl text-sm font-medium leading-none ${navItemClass(isActive)}`}
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
