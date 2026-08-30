'use client';

import { useEffect } from 'react';
import { QueryBoard } from '@/components/pos/query-board';
import { RecordsPageFrame } from '@/components/pos/records-page-frame';
import {
  QUERY_RECORDS_FIXTURE_ACCOUNT,
  QUERY_RECORDS_FIXTURE_ITEMS,
} from '@/lib/pos/__tests__/query-records-ui-fixture';
import {
  measureQueryBoardLastRow,
  readHarnessParams,
  type HarnessParams,
} from '@/lib/pos/__tests__/visual-harness/harness-params';

function applySearch(value: string) {
  const input = document.getElementById('pos-records-search');
  if (!(input instanceof HTMLInputElement)) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function QueryBoardVisualPreview({ params }: { params: HarnessParams }) {
  const items = params.scenario === 'empty' ? [] : QUERY_RECORDS_FIXTURE_ITEMS;
  const boardKey = `${params.scenario}::${params.search}::${params.scroll}`;

  useEffect(() => {
    window.__measureQueryBoard = measureQueryBoardLastRow;
    return () => {
      if (window.__measureQueryBoard === measureQueryBoardLastRow) {
        delete window.__measureQueryBoard;
      }
    };
  }, [boardKey]);

  useEffect(() => {
    if (!params.search) return;
    applySearch(params.search);
  }, [params.search, boardKey]);

  useEffect(() => {
    if (params.scroll !== 'end') return;
    const timer = window.setTimeout(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [params.scroll, boardKey]);

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <RecordsPageFrame account={QUERY_RECORDS_FIXTURE_ACCOUNT}>
        <QueryBoard key={boardKey} items={items} />
      </RecordsPageFrame>
    </div>
  );
}

export function QueryBoardVisualHarness() {
  const params = readHarnessParams();
  return <QueryBoardVisualPreview params={params} />;
}
