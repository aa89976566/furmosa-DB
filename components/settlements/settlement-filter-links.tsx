import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { settlementStatusLabel } from '@/lib/labels';
import { SETTLEMENT_STATUSES } from '@/lib/settlement-list-query';
import { formatTaipeiMonthLabel, recentTaipeiMonths } from '@/lib/taipei-date';

function buildHref(
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined | null>
) {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `/merchants/settlements?${q}` : '/merchants/settlements';
}

export function SettlementFilterLinks({
  filters,
  merchants,
}: {
  filters: { status?: string; month?: string; merchantId?: string };
  merchants: { id: string; name: string }[];
}) {
  const current = {
    status: filters.status,
    month: filters.month,
    merchantId: filters.merchantId,
  };

  const statusOptions = [
    { key: '', label: '全部狀態' },
    ...SETTLEMENT_STATUSES.map((s) => ({ key: s, label: settlementStatusLabel[s] })),
  ];

  const months = recentTaipeiMonths(6);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((s) => {
          const active = (filters.status ?? '') === s.key;
          return (
            <Button key={s.key || 'all-status'} size="sm" variant={active ? 'default' : 'outline'} asChild>
              <Link href={buildHref(current, { status: s.key || null })}>{s.label}</Link>
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!filters.month ? 'default' : 'outline'} asChild>
          <Link href={buildHref(current, { month: null })}>全部月份</Link>
        </Button>
        {months.map((m) => {
          const active = filters.month === m;
          return (
            <Button key={m} size="sm" variant={active ? 'default' : 'outline'} asChild>
              <Link href={buildHref(current, { month: m })}>{formatTaipeiMonthLabel(m)}</Link>
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">店家</span>
        <Button size="sm" variant={!filters.merchantId ? 'default' : 'outline'} asChild>
          <Link href={buildHref(current, { merchantId: null })}>全部店家</Link>
        </Button>
        {merchants.map((m) => {
          const active = filters.merchantId === m.id;
          return (
            <Button key={m.id} size="sm" variant={active ? 'default' : 'outline'} asChild>
              <Link href={buildHref(current, { merchantId: m.id })}>{m.name}</Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
