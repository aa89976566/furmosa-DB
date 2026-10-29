'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, ScanFace } from 'lucide-react';
import Link from 'next/link';

const roleLabel: Record<string, string> = {
  admin: '系統管理員',
  finance: '財務',
  staff: '營運',
  warehouse: '倉管',
  inventory_reviewer: '庫存與訂單審核',
};

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="開啟帳號選單"
          title="帳號與登出"
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
        >
          <Avatar>
            <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium md:hidden">帳號</span>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-[11px] text-muted-foreground">{email}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="space-y-0.5">
            <p>{name}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {roleLabel[role] ?? role}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/security">
            <ScanFace className="mr-2 h-4 w-4" />
            Face ID 登入
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>系統設定</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-accent"
          >
            <LogOut className="mr-2 h-4 w-4" />
            登出／切換帳號
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
