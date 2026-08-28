import Link from 'next/link';
import { ClipboardList, Recycle, Wallet, Warehouse } from 'lucide-react';
import { posNavItem, type PosHomeAction } from '@/lib/pos/pos-nav';

const ICONS = {
  stock: Warehouse,
  refill: Recycle,
  records: ClipboardList,
  settle: Wallet,
} as const;

export function HomeActionCard({ action }: { action: PosHomeAction }) {
  const nav = posNavItem(action.navId);
  const Icon = ICONS[action.navId];

  return (
    <Link
      href={nav.href}
      className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold text-zinc-900">{action.title}</span>
        <span className="mt-1 block text-base text-zinc-500">{action.purpose}</span>
      </span>
    </Link>
  );
}
