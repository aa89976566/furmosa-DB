import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { merchantStockTxnTypeLabel } from '@/lib/labels';
import { MERCHANT_STOCK_TXN_TYPES } from '@/lib/merchant-stock-query';
import { formatTaipeiMonthLabel, recentTaipeiMonths } from '@/lib/taipei-date';

function buildHref(
  basePath: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined | null>
) {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function MerchantStockFilterLinks({
  basePath,
  merchants,
  filters,
  view,
  hideViewTabs = false,
  showMerchantFilter = true,
}: {
  basePath: string;
  merchants: { id: string; name: string }[];
  filters: {
    merchantId?: string;
    type?: string;
    month?: string;
    settled?: string;
  };
  view?: 'txns' | 'levels';
  hideViewTabs?: boolean;
  showMerchantFilter?: boolean;
}) {
  const current = {
    merchantId: filters.merchantId,
    type: filters.type,
    month: filters.month,
    settled: filters.settled,
    view: view === 'levels' ? 'levels' : undefined,
  };

  const typeOptions: { key: string; label: string }[] = [
    { key: '', label: '全部類型' },
    ...MERCHANT_STOCK_TXN_TYPES.map((t) => ({
      key: t,
      label: merchantStockTxnTypeLabel[t],
    })),
  ];

  const settledOptions = [
    { key: '', label: '全部結清狀態' },
    { key: 'open', label: '未結清' },
    { key: 'settled', label: '已納入月結' },
  ];

  const months = recentTaipeiMonths(6);

  return (
    <div className="space-y-3">
      {!hideViewTabs && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={view !== 'levels' ? 'default' : 'outline'} asChild>
            <Link href={buildHref(basePath, current, { view: null })}>異動流水</Link>
          </Button>
          <Button size="sm" variant={view === 'levels' ? 'default' : 'outline'} asChild>
            <Link href={buildHref(basePath, current, { view: 'levels' })}>現有庫存</Link>
          </Button>
        </div>
      )}

      {view !== 'levels' && (
        <>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((t) => {
              const active = (filters.type ?? '') === t.key;
              return (
                <Button key={t.key || 'all-type'} size="sm" variant={active ? 'default' : 'outline'} asChild>
                  <Link href={buildHref(basePath, current, { type: t.key || null })}>{t.label}</Link>
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {settledOptions.map((s) => {
              const active = (filters.settled ?? '') === s.key;
              return (
                <Button key={s.key || 'all-settled'} size="sm" variant={active ? 'default' : 'outline'} asChild>
                  <Link href={buildHref(basePath, current, { settled: s.key || null })}>{s.label}</Link>
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!filters.month ? 'default' : 'outline'}
              asChild
            >
              <Link href={buildHref(basePath, current, { month: null })}>全部月份</Link>
            </Button>
            {months.map((m) => {
              const active = filters.month === m;
              return (
                <Button key={m} size="sm" variant={active ? 'default' : 'outline'} asChild>
                  <Link href={buildHref(basePath, current, { month: m })}>
                    {formatTaipeiMonthLabel(m)}
                  </Link>
                </Button>
              );
            })}
          </div>
        </>
      )}

      {showMerchantFilter && merchants.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">店家</span>
          <Button size="sm" variant={!filters.merchantId ? 'default' : 'outline'} asChild>
            <Link href={buildHref(basePath, current, { merchantId: null })}>全部店家</Link>
          </Button>
          {merchants.map((m) => {
            const active = filters.merchantId === m.id;
            return (
              <Button key={m.id} size="sm" variant={active ? 'default' : 'outline'} asChild>
                <Link href={buildHref(basePath, current, { merchantId: m.id })}>{m.name}</Link>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
