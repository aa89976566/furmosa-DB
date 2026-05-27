'use client';

import Link from 'next/link';
import { jarCodesPdfDownloadUrl } from '@/lib/jar-exchange/build-labels-pdf';

export function PrintActions({
  batch,
  count,
  totalInBatch,
  truncated,
  showAll,
  pageCount,
  cols,
  rows,
  perPage,
}: {
  batch: string;
  count: number;
  totalInBatch: number;
  truncated: boolean;
  showAll: boolean;
  pageCount: number;
  cols: number;
  rows: number;
  perPage: number;
}) {
  return (
    <div className="no-print sticky top-0 z-10 border-b bg-white shadow-sm">
      {truncated ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          此批次共有 {totalInBatch} 筆序號，目前僅顯示／匯出最早 {count} 筆（一張 A4）。
          <Link
            href={`/jar-exchange/codes?batch=${encodeURIComponent(batch)}&status=unused&all=1`}
            className="ml-1 font-medium underline"
          >
            查看全部
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="text-sm">
          <span className="font-medium">序號列印</span>
          <span className="ml-2 text-neutral-500">
            批次 {batch} · {count} 筆 · {pageCount} 頁
          </span>
          <span className="ml-2 text-xs text-neutral-400">
            40×20mm · {cols}×{rows}＝{perPage}／頁
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href="/jar-exchange/manage?tab=codes"
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            返回
          </Link>
          <a
            href={jarCodesPdfDownloadUrl(
              batch,
              'unused',
              showAll ? { all: true } : { limit: count },
            )}
            download
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            下載 PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm text-white hover:bg-neutral-800"
          >
            瀏覽器列印
          </button>
        </div>
      </div>
    </div>
  );
}
