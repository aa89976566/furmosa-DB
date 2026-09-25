import { formatCents, formatRateBps } from '@/lib/finance/money';
import type { MarginLight, MissingKind } from '@/lib/finance/formula';

export function costText(cents: number | null): string {
  return cents == null ? '待補成本' : formatCents(cents);
}

export function dataText(cents: number | null): string {
  return cents == null ? '待補資料' : formatCents(cents);
}

export function marginText(cents: number | null): string {
  return cents == null ? '—' : formatCents(cents);
}

export function rateText(bps: number | null): string {
  return bps == null ? '—' : formatRateBps(bps);
}

export function missingCostLabel(kind: MissingKind | null): string {
  if (kind === 'cost') return '待補成本';
  return '待補資料';
}

export const LIGHT_LABEL: Record<MarginLight, string> = {
  green: '綠燈',
  yellow: '黃燈',
  red: '紅燈',
};

export const LIGHT_COLOR: Record<MarginLight, string> = {
  green: '#1f7a4d',
  yellow: '#b58100',
  red: '#a32020',
};
