import { useEffect, useState } from 'react';
import { QueryBoard } from '@/components/pos/query-board';
import { RecordsPageFrame } from '@/components/pos/records-page-frame';
import {
  QUERY_RECORDS_FIXTURE_ACCOUNT,
  QUERY_RECORDS_FIXTURE_BANNER,
  QUERY_RECORDS_FIXTURE_ITEMS,
  QUERY_RECORDS_FIXTURE_LAST_TITLE,
} from '@/lib/pos/__tests__/query-records-ui-fixture';

type FixtureMode = 'populated' | 'empty';

function measureOverflowX(): boolean {
  return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
}

function measureLastRowVsBottomNav(): string {
  const nav = [...document.querySelectorAll('nav[aria-label="店家導航"]')].find((node) => {
    const style = window.getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return style.position === 'fixed' && style.display !== 'none' && box.height > 0;
  });
  const mobileCards = document.querySelectorAll('ul.space-y-3.md\\:hidden li');
  const last = mobileCards[mobileCards.length - 1];
  if (!nav || !last) return 'NOT RUN：此寬度沒有可見的手機底部導航或最後一張卡片';
  window.scrollTo(0, document.documentElement.scrollHeight);
  const lastBox = last.getBoundingClientRect();
  const navBox = nav.getBoundingClientRect();
  const hidden = lastBox.bottom > navBox.top + 1;
  return hidden
    ? `FAIL：最後一筆底部 ${Math.round(lastBox.bottom)} 被導航頂部 ${Math.round(navBox.top)} 遮住`
    : `PASS：最後一筆底部 ${Math.round(lastBox.bottom)}，導航頂部 ${Math.round(navBox.top)}`;
}

export function QueryBoardVisualHarness() {
  const [mode, setMode] = useState<FixtureMode>('populated');
  const [probe, setProbe] = useState('尚未量測');

  useEffect(() => {
    const update = () => {
      setProbe((current) => {
        const overflow = measureOverflowX() ? '有水平溢出' : '無水平溢出';
        const prefix = current.startsWith('FAIL') || current.startsWith('PASS') || current.startsWith('NOT RUN')
          ? current
          : '尚未量測最後一筆';
        return `${overflow}｜${prefix}`;
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mode]);

  return (
    <div>
      <div className="sticky top-0 z-50 border-b border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-xs font-medium text-white">
        {QUERY_RECORDS_FIXTURE_BANNER}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
        <button
          type="button"
          data-testid="fixture-mode-populated"
          className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ${
            mode === 'populated' ? 'bg-zinc-900 text-white' : 'border border-neutral-200 bg-white text-zinc-600'
          }`}
          onClick={() => setMode('populated')}
        >
          有資料
        </button>
        <button
          type="button"
          data-testid="fixture-mode-empty"
          className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ${
            mode === 'empty' ? 'bg-zinc-900 text-white' : 'border border-neutral-200 bg-white text-zinc-600'
          }`}
          onClick={() => setMode('empty')}
        >
          完全空資料
        </button>
        <button
          type="button"
          data-testid="fixture-check-last-row"
          className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-zinc-700"
          onClick={() => setProbe(measureLastRowVsBottomNav())}
        >
          檢查最後一筆
        </button>
        <p id="fixture-probe" className="text-xs text-zinc-600" data-testid="fixture-probe">
          {probe}
        </p>
      </div>
      <RecordsPageFrame account={QUERY_RECORDS_FIXTURE_ACCOUNT}>
        <QueryBoard items={mode === 'empty' ? [] : QUERY_RECORDS_FIXTURE_ITEMS} />
        {mode === 'populated' ? (
          <p className="sr-only">{QUERY_RECORDS_FIXTURE_LAST_TITLE}</p>
        ) : null}
      </RecordsPageFrame>
    </div>
  );
}
