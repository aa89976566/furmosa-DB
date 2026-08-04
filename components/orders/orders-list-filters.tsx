'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ORDER_SOURCE_TABS } from '@/lib/order-hub-kinds';
import { orderStatusLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'draft', label: orderStatusLabel.draft },
  { key: 'confirmed', label: orderStatusLabel.confirmed },
  { key: 'packed', label: orderStatusLabel.packed },
  { key: 'shipped', label: orderStatusLabel.shipped },
  { key: 'delivered', label: orderStatusLabel.delivered },
  { key: 'completed', label: orderStatusLabel.completed },
] as const;

function hrefFor(params: { source?: string; status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.source) sp.set('source', params.source);
  if (params.status) sp.set('status', params.status);
  if (params.q?.trim()) sp.set('q', params.q.trim());
  const qs = sp.toString();
  return qs ? `/orders?${qs}` : '/orders';
}

export function OrdersListFilters({
  source,
  status,
  q,
}: {
  source?: string;
  status?: string;
  q?: string;
}) {
  const router = useRouter();
  const normalizedSource = source === 'restock' ? 'consignment' : source;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-card p-1">
        {ORDER_SOURCE_TABS.map((s) => {
          const active = (normalizedSource ?? '') === s.key;
          return (
            <Link
              key={s.key || 'all'}
              href={hrefFor({
                source: s.key || undefined,
                status: status || undefined,
                q: q || undefined,
              })}
              prefetch
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-ink font-medium text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-ink',
              )}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="whitespace-nowrap">狀態</span>
        <select
          value={status ?? ''}
          className="h-9 rounded-xl border border-input bg-card px-3 text-sm text-ink"
          onChange={(e) => {
            router.push(
              hrefFor({
                source: normalizedSource || undefined,
                status: e.target.value || undefined,
                q: q || undefined,
              }),
            );
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.key || 'all'} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
