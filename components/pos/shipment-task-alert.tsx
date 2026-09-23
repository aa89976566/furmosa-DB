import Link from 'next/link';
import { PackageCheck, Truck } from 'lucide-react';
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
          className="group flex min-h-[80px] items-center gap-3 rounded-[22px] border border-zinc-950 bg-zinc-950 px-4 py-3 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-[0_16px_32px_rgba(0,0,0,0.24)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-zinc-950 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]">
            <PackageCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{receipt.title}</span>
            <span className="mt-0.5 block whitespace-pre-line text-sm text-zinc-300">
              {receipt.subtitle}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-2 text-sm font-semibold text-zinc-950 transition group-hover:bg-lime-300">
            確認入庫
          </span>
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
          <span className="shrink-0 rounded-full bg-secondary px-3 py-2 text-sm font-semibold">查看運送</span>
        </Link>
      ) : null}
    </section>
  );
}
