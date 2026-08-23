'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, House, PackagePlus, Repeat2, ShoppingCart } from 'lucide-react';

// 門市所有頁面共用同一組主要功能導覽。
const TABS = [
  {
    href: '/pos',
    label: '首頁',
    icon: House,
    match: (p: string) => p === '/pos' || p.startsWith('/pos/appointments'),
  },
  {
    href: '/pos/checkout',
    label: '收銀',
    icon: ShoppingCart,
    match: (p: string) => p === '/pos/checkout' || p.startsWith('/pos/checkout/'),
  },
  {
    href: '/pos/refill',
    label: '換罐',
    icon: Repeat2,
    match: (p: string) => p === '/pos/refill' || p.startsWith('/pos/refill/'),
  },
  {
    href: '/pos/restock',
    label: '補貨',
    icon: PackagePlus,
    match: (p: string) => p === '/pos/restock' || p.startsWith('/pos/restock/'),
  },
  {
    href: '/pos/records',
    label: '紀錄',
    icon: ClipboardList,
    match: (p: string) =>
      p === '/pos/records' ||
      p.startsWith('/pos/records/') ||
      p.startsWith('/pos/sales') ||
      p.startsWith('/pos/settlements'),
  },
] as const;

export function PosBottomNav() {
  const pathname = usePathname() || '/pos';

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] border-r border-[#e7e5e4] bg-white md:flex md:flex-col">
        <div className="border-b border-[#e7e5e4] px-5 py-5">
          <p className="text-lg font-semibold tracking-tight">Furmosa</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            店家 POS
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="店家導航">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  active ? 'bg-[#191919] text-white' : 'text-[#5f5f5f] hover:bg-[#f2f2f2] hover:text-[#191919]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#e7e5e4] p-4 text-xs leading-5 text-muted-foreground">
          門市營運系統<br />資料即時同步
        </div>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7e5e4] bg-white/95 backdrop-blur md:hidden"
        aria-label="店家導航"
      >
        <div className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[62px] flex-1 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-medium transition ${
                active
                  ? 'border-[#191919] text-[#191919]'
                  : 'border-transparent text-[#6b6b6b] hover:text-[#191919]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
