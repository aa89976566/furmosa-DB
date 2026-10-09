import Link from 'next/link';
import type { PosRefillStockSummary } from '@/lib/pos/refill-stock-summary';

export function RefillStockSummary({ summary }: { summary: PosRefillStockSummary }) {
  return (
    <Link
      href="/pos/refill"
      className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-emerald-950">換罐庫存</p>
        <p className="mt-1 truncate text-xs text-emerald-800">
          {summary.flavours.length > 0
            ? summary.flavours.map((flavour) => `${flavour.name} ${flavour.quantity}`).join('　')
            : '目前沒有可換罐的庫存'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xl font-semibold tabular-nums text-emerald-950">{summary.total}</p>
        <p className="text-xs text-emerald-800">罐可換</p>
      </div>
    </Link>
  );
}
