'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/finance/products', label: '商品毛利' },
  { href: '/finance/channels', label: '通路損益' },
  { href: '/finance/partners', label: '合作店與換罐' },
  { href: '/finance/cash-flow', label: '13 週現金流' },
];

export function FinanceSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="財務與單位經濟" className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 sm:px-6">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm',
              active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
