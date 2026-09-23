import Link from 'next/link';
import { ArrowRight, PackageCheck, Truck } from 'lucide-react';
import { loadHomeTasks } from '@/lib/pos/load-today-dashboard';

export async function PosShipmentTaskAlert({ merchantId }: { merchantId: string }) {
  const { cards } = await loadHomeTasks(merchantId);
  const receipt = cards.find((card) => card.kind === 'awaiting_restock_receipt');
  const progress = cards.find((card) => card.kind === 'in_transit_restock');

  if (!receipt && !progress) return null;

  return (
    <section className="shrink-0 px-3 pt-3 md:px-4" aria-label="補貨進度">
      {receipt ? (
        <Link
          href={receipt.href}
          className="group flex min-h-[76px] items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-200">
            <PackageCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{receipt.title}</span>
            <span className="mt-0.5 block whitespace-pre-line text-sm text-amber-900/80">
              {receipt.subtitle}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-amber-950 px-3 py-1.5 text-sm font-semibold text-white">
            {receipt.badge} {receipt.badgeUnit}
          </span>
          <ArrowRight className="hidden h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
        </Link>
      ) : progress ? (
        <Link
          href={progress.href}
          className="group flex min-h-[64px] items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Truck className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{progress.title}</span>
            <span className="block text-sm text-muted-foreground">{progress.subtitle}</span>
          </span>
          <span className="text-sm font-medium">查看進度</span>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
