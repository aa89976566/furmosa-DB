import type { MarginLight } from '@/lib/finance/formula';
import { LIGHT_COLOR, LIGHT_LABEL, costText, dataText, marginText, rateText } from '@/lib/finance/format';

export function CostText({ cents }: { cents: number | null }) {
  const missing = cents == null;
  return <span className={missing ? 'text-muted-foreground' : undefined}>{costText(cents)}</span>;
}

export function DataText({ cents }: { cents: number | null }) {
  const missing = cents == null;
  return <span className={missing ? 'text-muted-foreground' : undefined}>{dataText(cents)}</span>;
}

export function MarginText({ cents }: { cents: number | null }) {
  return <span className={cents == null ? 'text-muted-foreground' : undefined}>{marginText(cents)}</span>;
}

export function RateText({ bps }: { bps: number | null }) {
  return <span className={bps == null ? 'text-muted-foreground' : undefined}>{rateText(bps)}</span>;
}

export function MarginLightMark({ light }: { light: MarginLight | null }) {
  if (!light) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: LIGHT_COLOR[light] }}
      />
      <span>{LIGHT_LABEL[light]}</span>
    </span>
  );
}
