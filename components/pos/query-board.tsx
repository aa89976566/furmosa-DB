'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { QueryFeedItem } from '@/lib/pos/query-feed';
import {
  QUERY_CLEAR_FILTERS_LABEL,
  QUERY_ERROR_HINT,
  QUERY_ERROR_TITLE,
  QUERY_KIND_FILTERS,
  QUERY_SEARCH_HINT,
  QUERY_SEARCH_LABEL,
  presentQueryRecord,
  queryRecordsListMode,
  querySearchFeedback,
  type QueryKindFilterId,
  type QueryRecordsViewState,
} from '@/lib/pos/query-records-view';

export function QueryBoard({
  items,
  state = 'ready',
  onRetry,
}: {
  items: QueryFeedItem[];
  state?: QueryRecordsViewState;
  onRetry?: () => void;
}) {
  const [kind, setKind] = useState<QueryKindFilterId>('all');
  const [query, setQuery] = useState('');
  const view = useMemo(
    () => queryRecordsListMode({ state, items, kind, query }),
    [state, items, kind, query],
  );
  const searchFeedback = querySearchFeedback(query);

  function clearFilters() {
    setKind('all');
    setQuery('');
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="max-w-2xl space-y-2">
        <label htmlFor="pos-records-search" className="block text-sm font-medium text-zinc-900">
          {QUERY_SEARCH_LABEL}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            id="pos-records-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如罐號、商品名稱或補貨單號"
            aria-describedby="pos-records-search-hint"
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-white py-2 pl-11 pr-24 text-sm outline-none transition focus:border-zinc-400"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-xl px-2 text-sm text-zinc-700 hover:bg-neutral-100"
            >
              清除搜尋
            </button>
          ) : null}
        </div>
        <p id="pos-records-search-hint" className="text-sm text-zinc-500">
          {QUERY_SEARCH_HINT}
        </p>
        {searchFeedback ? (
          <p className="text-sm text-zinc-700" aria-live="polite">
            {searchFeedback}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="紀錄類型">
        {QUERY_KIND_FILTERS.map((tab) => {
          const selected = kind === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium ${
                selected
                  ? 'bg-zinc-900 text-white'
                  : 'border border-neutral-200 bg-white text-zinc-600'
              }`}
              onClick={() => setKind(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {view.mode === 'loading' ? <QueryRecordsSkeleton /> : null}

      {view.mode === 'error' ? (
        <div className="rounded-2xl border border-neutral-300 bg-white p-5">
          <p className="font-medium text-zinc-900">{QUERY_ERROR_TITLE}</p>
          <p className="mt-1 text-sm text-zinc-600">{QUERY_ERROR_HINT}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-zinc-900 bg-zinc-900 px-4 text-sm font-medium text-white"
            >
              再試一次
            </button>
          ) : null}
        </div>
      ) : null}

      {view.mode === 'empty' || view.mode === 'no_matches' ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-zinc-900">{view.emptyMessage}</p>
          {view.mode === 'no_matches' ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-zinc-900"
            >
              {QUERY_CLEAR_FILTERS_LABEL}
            </button>
          ) : null}
        </div>
      ) : null}

      {view.mode === 'list' ? (
        <>
          <p className="text-sm text-zinc-500">共 {view.visible.length} 筆</p>
          <QueryRecordsList items={view.visible} />
        </>
      ) : null}
    </div>
  );
}

function QueryRecordsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      <p className="text-sm text-zinc-500">正在讀取紀錄…</p>
      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white md:block">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={`grid min-h-[72px] grid-cols-[7rem_7rem_minmax(0,1fr)_6rem] items-center gap-4 px-5 py-3 ${
              index === 0 ? '' : 'border-t border-neutral-100'
            }`}
          >
            <span className="h-4 w-16 rounded bg-neutral-200" />
            <span className="h-4 w-20 rounded bg-neutral-200" />
            <span className="h-4 w-3/4 rounded bg-neutral-200" />
            <span className="h-6 w-16 justify-self-end rounded-full bg-neutral-200" />
          </div>
        ))}
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <span className="block h-3 w-16 rounded bg-neutral-200" />
            <span className="mt-3 block h-5 w-2/3 rounded bg-neutral-200" />
            <span className="mt-2 block h-4 w-1/2 rounded bg-neutral-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function QueryRecordsList({ items }: { items: QueryFeedItem[] }) {
  const rows = items.map((item) => presentQueryRecord(item));
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium text-zinc-500">
            <tr>
              <th className="w-28 px-5 py-3">類型</th>
              <th className="w-28 px-3 py-3">時間</th>
              <th className="px-3 py-3">內容</th>
              <th className="w-28 px-5 py-3 text-right">狀態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-neutral-100">
                <td className="px-5 py-3 align-top font-medium text-zinc-900">{row.kindLabel}</td>
                <td className="px-3 py-3 align-top text-zinc-600">{row.whenLabel}</td>
                <td className="px-3 py-3 align-top">
                  <RecordBody row={row} />
                </td>
                <td className="px-5 py-3 align-top text-right">
                  <StatusMark label={row.statusLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <RecordLink href={row.href} className="block rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium tracking-wide text-zinc-500">{row.kindLabel}</p>
                {row.whenLabel ? <p className="text-xs text-zinc-500">{row.whenLabel}</p> : null}
              </div>
              {row.detail ? (
                <p className="mt-2 break-words font-medium text-zinc-900">{row.detail}</p>
              ) : null}
              {row.extra ? (
                <p className="mt-1 break-words text-sm text-zinc-600">{row.extra}</p>
              ) : null}
              <div className="mt-3">
                <StatusMark label={row.statusLabel} />
              </div>
            </RecordLink>
          </li>
        ))}
      </ul>
    </>
  );
}

function RecordBody({
  row,
}: {
  row: ReturnType<typeof presentQueryRecord>;
}) {
  return (
    <RecordLink href={row.href} className="block min-w-0">
      {row.detail ? <p className="break-words font-medium text-zinc-900">{row.detail}</p> : null}
      {row.extra ? <p className="mt-0.5 break-words text-zinc-600">{row.extra}</p> : null}
    </RecordLink>
  );
}

function RecordLink({
  href,
  className,
  children,
}: {
  href: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function StatusMark({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800">
      {label}
    </span>
  );
}
