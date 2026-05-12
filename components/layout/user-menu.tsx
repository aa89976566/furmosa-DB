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
import { LogOut } from 'lucide-react';

const roleLabel: Record<string, string> = {
  admin: '系統管理員',
  finance: '財務',
  staff: '營運',
  warehouse: '倉管',
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
        <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
          <Avatar>
            <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-[11px] text-muted-foreground">{email}</p>
          </div>
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
        <DropdownMenuItem disabled>個人資料</DropdownMenuItem>
        <DropdownMenuItem disabled>系統設定</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-accent"
          >
            <LogOut className="mr-2 h-4 w-4" />
            登出
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
