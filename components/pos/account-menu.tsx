'use client';

import Link from 'next/link';
import { MoreHorizontal, UserRound } from 'lucide-react';
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
  variant = 'icon',
}: {
  account: PosAccount;
  variant?: 'icon' | 'dots' | 'store';
}) {
  const heading = storeHeading({ name: account.storeName, city: account.storeCity });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'store' ? (
          <button type="button" className="w-full rounded-xl px-1 py-1 text-left">
            <p className="truncate text-sm font-medium text-zinc-900">{heading.combined}</p>
            <p className="truncate text-sm text-zinc-500">店員 {account.staffName}</p>
          </button>
        ) : (
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-navy transition-colors hover:bg-muted"
            aria-label="店家選單"
          >
            {variant === 'dots' ? (
              <MoreHorizontal className="h-5 w-5" />
            ) : (
              <UserRound className="h-5 w-5" />
            )}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <p className="text-sm font-semibold text-navy">{heading.brandLine}</p>
          {heading.branchLine ? (
            <p className="text-xs text-muted-foreground">{heading.branchLine}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-[44px] rounded-xl">
          <Link href="/pos/account">店家資料</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="min-h-[44px] rounded-xl">
          店員 {account.staffName}
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-[44px] rounded-xl">
          <a href={FURMOSA_CONTACT.lineUrl} target="_blank" rel="noreferrer">
            聯絡匠寵
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={posLogoutAction}>
          <button
            type="submit"
            className="flex min-h-[44px] w-full items-center rounded-xl px-2 text-sm text-destructive"
          >
            登出
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
