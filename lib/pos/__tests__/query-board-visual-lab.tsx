'use client';

import { useState } from 'react';
import { HARNESS_NO_MATCH_QUERY, type LastRowMeasure } from '@/lib/pos/__tests__/visual-harness/harness-params';

const PREVIEW_LINKS = [
  { href: '/?scenario=populated', label: '有資料' },
  { href: '/?scenario=empty', label: '完全沒有紀錄' },
  { href: `/?scenario=no_matches&q=${encodeURIComponent(HARNESS_NO_MATCH_QUERY)}`, label: '搜尋無結果' },
  { href: '/?scenario=populated&scroll=end', label: '有資料並捲到最後一筆' },
];

export function QueryBoardVisualLab() {
  const [src, setSrc] = useState('/?scenario=populated');
  const [measure, setMeasure] = useState<LastRowMeasure | null>(null);

  function openPreview(href: string) {
    setSrc(href);
    setMeasure(null);
  }

  async function runMeasure() {
    setMeasure(null);
    const frame = document.querySelector('iframe[data-testid="fixture-preview-frame"]');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
      setMeasure({
        overflowX: false,
        lastRow: 'N/A',
        reason: '找不到產品預覽 iframe',
        innerWidth: 0,
        innerHeight: 0,
      });
      return;
    }
    const fn = frame.contentWindow.__measureQueryBoard;
    if (typeof fn !== 'function') {
      setMeasure({
        overflowX: false,
        lastRow: 'N/A',
        reason: '預覽尚未提供量測函式',
        innerWidth: 0,
        innerHeight: 0,
      });
      return;
    }
    setMeasure(fn());
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-zinc-900">
      <aside className="border-b border-neutral-200 bg-white px-4 py-3">
        <p className="text-sm font-medium">查詢頁 visual lab（測試控制，不是店家畫面）</p>
        <p className="mt-1 text-xs text-zinc-600">截圖請開右側預覽以外的獨立預覽網址，勿把本列拍進去。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PREVIEW_LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 bg-white px-4 text-sm"
              onClick={() => openPreview(link.href)}
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-zinc-900 bg-zinc-900 px-4 text-sm text-white"
            onClick={() => void runMeasure()}
          >
            量測 iframe 預覽
          </button>
        </div>
        {measure ? (
          <p className="mt-2 text-xs text-zinc-700" data-testid="fixture-lab-probe">
            {measure.lastRow}：{measure.reason}（{measure.innerWidth}×{measure.innerHeight}）
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">尚未量測。切換情境會清除舊結果。</p>
        )}
        <ul className="mt-2 list-disc pl-5 text-xs text-zinc-600">
          {PREVIEW_LINKS.map((link) => (
            <li key={link.href}>
              <a className="underline" href={link.href}>
                {link.label}：{link.href}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <iframe
        data-testid="fixture-preview-frame"
        title="產品預覽"
        src={src}
        className="h-[844px] w-[390px] border-0 bg-white"
      />
    </div>
  );
}
