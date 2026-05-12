import { format, formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export function formatCurrency(value: number | string | null | undefined, currency = 'TWD') {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | string | null | undefined) {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return new Intl.NumberFormat('zh-TW').format(n);
}

export function formatPercent(value: number | string | null | undefined, fractionDigits = 1) {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return `${(n * 100).toFixed(fractionDigits)}%`;
}

export function formatDate(date: Date | string | null | undefined, pattern = 'yyyy/MM/dd') {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, pattern, { locale: zhTW });
}

export function formatDateTime(date: Date | string | null | undefined) {
  return formatDate(date, 'yyyy/MM/dd HH:mm');
}

export function formatRelative(date: Date | string | null | undefined) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: zhTW });
}
