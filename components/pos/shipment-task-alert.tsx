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
          className="group grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-[20px] border border-zinc-900/75 bg-[#fcfcfa] px-5 py-4 text-zinc-950 shadow-[0_3px_0_rgba(24,24,27,0.08),0_10px_24px_rgba(24,24,27,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_4px_0_rgba(24,24,27,0.12),0_14px_28px_rgba(24,24,27,0.1)] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 md:px-6"
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-zinc-200 bg-white text-zinc-900">
              <PackageCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-300 ring-4 ring-lime-300/20" />
                {receipt.title}
              </span>
              <span className="mt-1 block whitespace-pre-line text-sm leading-5 text-zinc-500">
                {receipt.subtitle}
              </span>
            </span>
          </span>
          <span className="flex min-h-11 min-w-[112px] shrink-0 items-center justify-center rounded-xl border border-zinc-950 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition duration-200 group-hover:bg-lime-300 group-hover:shadow-[2px_2px_0_rgba(24,24,27,0.9)] group-active:translate-x-px group-active:translate-y-px group-active:shadow-none">
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
