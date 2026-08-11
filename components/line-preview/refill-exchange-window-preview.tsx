'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PreviewTranscript } from '@/components/line-preview/preview-message-list';
import { cn } from '@/lib/utils';
import {
  REFILL_EXCHANGE_PREVIEW_FIXTURE,
  REFILL_EXCHANGE_PREVIEW_STATES,
  REFILL_EXCHANGE_PREVIEW_STATE_LABELS,
  buildRefillExchangePreviewTranscript,
  getRefillExchangePreviewMeta,
  type RefillExchangePreviewStateId,
} from '@/lib/refill/exchange-entitlement-preview';

function parseState(raw: string | null): RefillExchangePreviewStateId {
  if (
    raw &&
    (REFILL_EXCHANGE_PREVIEW_STATES as readonly string[]).includes(raw)
  ) {
    return raw as RefillExchangePreviewStateId;
  }
  return 'join-before';
}

type ViewportMode = 'desktop' | 'mobile';

export function RefillExchangeWindowPreview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = parseState(searchParams.get('state'));
  const [viewport, setViewport] = useState<ViewportMode>('desktop');

  const transcript = useMemo(
    () => buildRefillExchangePreviewTranscript(state),
    [state],
  );
  const meta = getRefillExchangePreviewMeta(state);

  const setState = (next: RefillExchangePreviewStateId) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('state', next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <p className="font-semibold">Preview／尚未上線 — 不會傳送 LINE 或寫入資料</p>
        <p className="mt-1 text-amber-900/90">
          此頁只組裝 Phase 1 文案與 Flex JSON，供桌機／窄版視覺驗收。未接 live
          核銷、未接空瓶確認建立資格、未接 cron／push。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Preview only</Badge>
        <Badge variant="outline">liveEnforcement：否</Badge>
        <Badge variant="outline">readsDb：否</Badge>
        <Badge variant="secondary">
          目前：{REFILL_EXCHANGE_PREVIEW_STATE_LABELS[state]}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="換購期限預覽狀態">
        {REFILL_EXCHANGE_PREVIEW_STATES.map((id) => (
          <Button
            key={id}
            type="button"
            role="tab"
            aria-selected={state === id}
            size="sm"
            variant={state === id ? 'default' : 'outline'}
            onClick={() => setState(id)}
          >
            {REFILL_EXCHANGE_PREVIEW_STATE_LABELS[id]}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={viewport === 'desktop' ? 'secondary' : 'outline'}
          onClick={() => setViewport('desktop')}
        >
          桌面寬度（420px）
        </Button>
        <Button
          type="button"
          size="sm"
          variant={viewport === 'mobile' ? 'secondary' : 'outline'}
          onClick={() => setViewport('mobile')}
        >
          手機窄版（320px）
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        驗收 fixture：店名「{REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName}」；啟用日
        {REFILL_EXCHANGE_PREVIEW_FIXTURE.activatedAtIso}（Asia/Taipei）。精確路徑：
        <code className="mx-1 rounded bg-muted px-1 py-0.5">{meta.path}</code>
      </p>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/40 py-3">
          <CardTitle className="text-base">
            換購期限 LINE Flex 預覽 · {REFILL_EXCHANGE_PREVIEW_STATE_LABELS[state]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto bg-[#EFEAE4] px-3 py-4 sm:px-6">
            <div
              className={cn(
                'mx-auto min-w-0 rounded-[28px] border border-stone-300 bg-[#EFEAE4] p-3 shadow-inner',
                viewport === 'mobile' ? 'w-[320px]' : 'w-[420px]',
              )}
              data-preview-viewport={viewport}
            >
              <PreviewTranscript items={transcript} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
