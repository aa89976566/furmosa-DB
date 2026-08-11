'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { labelPetTag } from '@/lib/line/morning/admin-labels';
import { renderJokeMessage } from '@/lib/line/morning/renderer';
import type { MorningContentRow } from '@/lib/line/morning/content';
import { CodeHint, ContentActions, StatusLabel } from './shared';

type ContentStatusFilter = 'all' | 'DRAFT' | 'APPROVED' | 'ARCHIVED';

const FILTER_OPTIONS: Array<{ value: ContentStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'DRAFT', label: '待確認' },
  { value: 'APPROVED', label: '可使用' },
  { value: 'ARCHIVED', label: '已封存' },
];

function kindLabel(kind: string): string {
  switch (kind) {
    case 'joke':
      return '笑話';
    case 'animal_fact':
      return '冷知識';
    case 'news':
      return '新聞';
    default:
      return kind;
  }
}

export function ContentPanel({ contents }: { contents: MorningContentRow[] }) {
  const [filter, setFilter] = useState<ContentStatusFilter>('all');

  const counts = useMemo(() => {
    return {
      all: contents.length,
      DRAFT: contents.filter((c) => c.status === 'DRAFT').length,
      APPROVED: contents.filter((c) => c.status === 'APPROVED').length,
      ARCHIVED: contents.filter((c) => c.status === 'ARCHIVED').length,
    } satisfies Record<ContentStatusFilter, number>;
  }, [contents]);

  const options = FILTER_OPTIONS.map((o) => ({
    ...o,
    label: `${o.label}（${counts[o.value]}）`,
  }));

  const rows =
    filter === 'all' ? contents : contents.filter((c) => c.status === filter);

  return (
    <div
      role="tabpanel"
      id="morning-panel-content"
      aria-labelledby="morning-tab-content"
      className="space-y-3"
    >
      <div>
        <h2 className="text-base font-semibold">內容庫</h2>
        <p className="text-sm text-muted-foreground">
          待確認／可使用／已封存。主卡顯示實際文案；技術代碼收進 details。
        </p>
      </div>

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={options}
        className="w-full justify-start overflow-x-auto"
      />

      {rows.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
          role="status"
        >
          此分組尚無內容。可到「系統狀態」載入草稿範例。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const preview = renderJokeMessage({ body: c.body });
            return (
              <article
                key={c.id}
                className="flex flex-col rounded-xl border p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <StatusLabel code={c.status} />
                  <Badge variant="outline" className="font-normal">
                    {kindLabel(c.kind)}
                  </Badge>
                </div>
                <p className="mt-2 flex-1 whitespace-pre-wrap break-words">
                  {preview.text}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.petTags.map((t) => labelPetTag(t)).join('、') || '一般'}
                  {' · '}
                  {preview.charCount} 字
                  {preview.truncated ? '（已截）' : ''}
                </p>
                <div className="mt-2">
                  <ContentActions id={c.id} status={c.status} />
                </div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    技術細節
                  </summary>
                  <div className="mt-1 space-y-1 text-muted-foreground">
                    <div>
                      stableId：<CodeHint>{c.stableId}</CodeHint>
                    </div>
                    <div>
                      kind：<CodeHint>{c.kind}</CodeHint>
                    </div>
                    <div>
                      tags：
                      <CodeHint>{c.petTags.join(', ') || '—'}</CodeHint>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
