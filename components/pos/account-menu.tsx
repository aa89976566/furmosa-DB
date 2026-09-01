'use client';

import Link from 'next/link';
import { posLogoutAction } from '@/app/pos/actions';
import { FURMOSA_CONTACT } from '@/lib/pos/contact';
import { storeHeading } from '@/lib/pos/store-display';
import type { PosAccount } from '@/lib/pos/account';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function PosAccountMenu({
  account,
  variant = 'header',
}: {
  account: PosAccount;
  variant?: 'icon' | 'dots' | 'store' | 'header';
}) {
  const heading = storeHeading({ name: account.storeName, city: account.storeCity });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'store' ? (
          <button
            type="button"
            className="w-full rounded-xl px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            <p className="truncate text-sm font-medium text-zinc-900">{heading.combined}</p>
            <p className="truncate text-sm text-zinc-500">{account.staffName}</p>
            <p className="mt-1 text-sm font-medium text-zinc-700">開啟帳號選單</p>
          </button>
        ) : (
          <button
            type="button"
            className="flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            帳號
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <p className="text-sm font-semibold text-zinc-900">{heading.brandLine}</p>
          {heading.branchLine ? (
            <p className="text-sm text-zinc-500">{heading.branchLine}</p>
          ) : null}
          <p className="mt-1 text-sm text-zinc-500">{account.staffName}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 rounded-xl text-sm">
          <Link href="/pos/account">查看店家資料</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11 rounded-xl text-sm">
          <a href={FURMOSA_CONTACT.lineUrl} target="_blank" rel="noreferrer">
            聯絡匠寵
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={posLogoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center rounded-xl px-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            登出
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
