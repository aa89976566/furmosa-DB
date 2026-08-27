import { formatCurrency } from '@/lib/format';

export type QueryKind = 'sale' | 'refill' | 'restock' | 'stock';

export type QueryFeedItem = {
  id: string;
  kind: QueryKind;
  at: string;
  title: string;
  subtitle: string;
  status: string;
  href: string;
  searchText: string;
};

function sameSecondKey(date: Date): string {
  return String(Math.floor(date.getTime() / 1000));
}

function formatWhen(date: Date, now = new Date()): string {
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

export function groupSaleLines(
  rows: {
    id: string;
    createdAt: Date;
    quantity: number;
    unitPrice: number | null;
    productName: string;
  }[],
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
    return {
      id: `sale-${key}`,
      kind: 'sale' as const,
      at: at.toISOString(),
      title: names,
      subtitle: formatCurrency(total),
      status: '已完成',
      href: '/pos/records',
      searchText: `${names} ${total}`.toLowerCase(),
    };
  });
}

export function formatQueryWhen(iso: string, now = new Date()): string {
  return formatWhen(new Date(iso), now);
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
