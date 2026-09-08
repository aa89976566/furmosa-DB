import { formatCurrency } from '@/lib/format';

export type QueryKind = 'sale' | 'refill' | 'restock' | 'stock';

export type QueryFeedItem = {
  id: string;
  kind: QueryKind;
  at: string;
  whenLabel: string;
  title: string;
  subtitle: string;
  status: string;
  href: string;
  searchText: string;
};

/** Taipei has had no DST since 1979; safe for this POS data (2024+). */
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

function sameSecondKey(date: Date): string {
  return String(Math.floor(date.getTime() / 1000));
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function taipeiParts(date: Date) {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function formatTaipeiClock(hour: number, minute: number): string {
  const period = hour < 12 ? '上午' : '下午';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period}${hour12}:${String(minute).padStart(2, '0')}`;
}

export function formatQueryWhen(iso: string, now: Date): string {
  const date = new Date(iso);
  if (!isValidDate(date) || !isValidDate(now)) return '—';
  const at = taipeiParts(date);
  const current = taipeiParts(now);
  if (at.year === current.year && at.month === current.month && at.day === current.day) {
    return formatTaipeiClock(at.hour, at.minute);
  }
  return `${String(at.month).padStart(2, '0')}/${String(at.day).padStart(2, '0')}`;
}

export function groupSaleLines(
  rows: {
    id: string;
    createdAt: Date;
    quantity: number;
    unitPrice: number | null;
    productName: string;
  }[],
  now: Date,
): QueryFeedItem[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = sameSecondKey(row.createdAt);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, lines]) => {
    const at = lines[0]!.createdAt;
    const names = lines
      .map((l) => `${l.productName} × ${Math.abs(l.quantity)}`)
      .join('、');
    const total = lines.reduce(
      (sum, l) => sum + Math.abs(l.quantity) * (l.unitPrice ?? 0),
      0,
    );
    const atIso = at.toISOString();
    return {
      id: `sale-${key}`,
      kind: 'sale' as const,
      at: atIso,
      whenLabel: formatQueryWhen(atIso, now),
      title: names,
      subtitle: formatCurrency(total),
      status: '已完成',
      href: '/pos/records',
      searchText: `${names} ${total}`.toLowerCase(),
    };
  });
}

export function filterQueryFeed(
  items: QueryFeedItem[],
  kind: QueryKind | 'all',
  query: string,
): QueryFeedItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false;
    if (!q) return true;
    return (
      item.searchText.includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });
}
