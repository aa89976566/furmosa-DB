'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PreviewTranscript } from '@/components/line-preview/preview-message-list';
import {
  JIBA_PREVIEW_STEP_LABELS,
  applyJibaPreviewInput,
  createInitialJibaPreviewState,
  listJibaPreviewSuggestedActions,
  resetJibaPreviewState,
  runJibaPreviewHappyPath,
} from '@/lib/line/campaigns/jiba-unbox/preview-engine';
import type { JibaPreviewState } from '@/lib/line/campaigns/jiba-unbox/preview-types';

export function JibaUnboxPreview() {
  const [state, setState] = useState<JibaPreviewState>(() =>
    createInitialJibaPreviewState(),
  );
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.transcript.length]);

  const suggestions = listJibaPreviewSuggestedActions(state);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((prev) => applyJibaPreviewInput(prev, trimmed));
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <p className="font-semibold">僅預覽，不會傳送 LINE 或寫入資料</p>
        <p className="mt-1 text-amber-900/90">
          此頁為 HQ 桌機模擬器：純瀏覽器記憶體、不呼叫 webhook／Reply／Push、不讀寫資料庫、不使用
          channel token 或真實 userId。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          目前步驟：{JIBA_PREVIEW_STEP_LABELS[state.step]}
        </Badge>
        {state.productKey ? (
          <Badge variant="outline">
            商品路徑：{state.productKey === 'jiba' ? '雞霸兩片' : '青蛙凍乾'}
          </Badge>
        ) : (
          <Badge variant="outline">商品路徑：尚未選擇</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setState(resetJibaPreviewState())}
        >
          重設預覽
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setState(runJibaPreviewHappyPath('jiba'))}
        >
          一鍵跑完：雞霸兩片
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setState(runJibaPreviewHappyPath('frog'))}
        >
          一鍵跑完：青蛙凍乾
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base">雞霸開箱對話預覽</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto bg-[#EFEAE4] px-3 py-4 sm:px-4">
              <PreviewTranscript items={state.transcript} />
              <div ref={bottomRef} />
            </div>
            <div className="space-y-3 border-t bg-background p-3">
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Button
                      key={s.text}
                      type="button"
                      size="sm"
                      variant={s.kind === 'primary' ? 'default' : 'outline'}
                      onClick={() => send(s.text)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(draft);
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="輸入模擬訊息（僅預覽）"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="模擬使用者訊息"
                />
                <Button type="submit" size="sm" className="shrink-0">
                  送出
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">預覽狀態（mock）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>收件人：{state.recipientName || '—'}</p>
            <p>手機：{state.recipientPhone || '—'}</p>
            <p>門市：{state.storeName || '—'}</p>
            <p>IG：{state.instagramHandle || '—'}</p>
            <p>毛孩：{state.petName ?? '（略過／未填）'}</p>
            <p className="pt-2 text-xs leading-relaxed">
              Flex 為結構預覽（標題／說明／按鈕標籤）；完整 payload 請展開對話泡泡下方「原始
              JSON payload」。圖片為同站靜態路徑，正式 LINE 會用絕對網址。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
