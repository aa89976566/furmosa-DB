import {
  defaultTaipeiMonthToTodayInputs,
  parseTaipeiDateRange,
  previousTaipeiMonthInputs,
} from '@/lib/taipei-date';
import type { StoreRedemptionReportFilter } from '@/lib/coupons/service';

export type StoreRedemptionReportParams = {
  from: string;
  to: string;
  storeSlug: string | null;
  storeLabel: string | null;
  filter: StoreRedemptionReportFilter;
  range: { start: Date; end: Date };
};

function pickParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const v = searchParams[key];
  return typeof v === 'string' ? v.trim() : undefined;
}

export function buildStoreReportHref(input: {
  from: string;
  to: string;
  store?: string | null;
}) {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.store) params.set('store', input.store);
  return `/admin/store-report?${params.toString()}`;
}

export function parseStoreRedemptionReportParams(
  searchParams: Record<string, string | string[] | undefined>,
  stores: { slug: string; name: string }[],
): StoreRedemptionReportParams {
  const defaults = defaultTaipeiMonthToTodayInputs();
  const fromInput = pickParam(searchParams, 'from') ?? defaults.from;
  const toInput = pickParam(searchParams, 'to') ?? defaults.to;
  const range =
    parseTaipeiDateRange(fromInput, toInput) ??
    parseTaipeiDateRange(defaults.from, defaults.to)!;

  const rawStore = pickParam(searchParams, 'store');
  const matchedStore = rawStore ? stores.find((s) => s.slug === rawStore) : null;
  const storeSlug = matchedStore?.slug ?? null;
  const storeLabel = matchedStore?.name ?? null;

  const filter: StoreRedemptionReportFilter = {
    redeemedFrom: range.start,
    redeemedTo: range.end,
    storeId: storeSlug ?? undefined,
  };

  return {
    from: fromInput,
    to: toInput,
    storeSlug,
    storeLabel,
    filter,
    range,
  };
}

export function storeReportQuickPresets(storeSlug: string | null) {
  const thisMonth = defaultTaipeiMonthToTodayInputs();
  const lastMonth = previousTaipeiMonthInputs();
  return [
    { key: 'this-month', label: '本月', ...thisMonth },
    { key: 'last-month', label: '上月', ...lastMonth },
  ].map((preset) => ({
    ...preset,
    href: buildStoreReportHref({
      from: preset.from,
      to: preset.to,
      store: storeSlug,
    }),
  }));
}
