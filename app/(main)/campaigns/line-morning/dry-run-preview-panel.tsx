'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  runMorningDryRunPreviewAction,
  type MorningDryRunPreviewResult,
} from './actions';

const MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'jokes', label: '1 僅毛孩笑話 (HUMOR_ONLY)' },
  { value: 'news', label: '2 新鮮事｜跳過 (NEWS_ONLY)' },
  {
    value: 'news_first_fact_fallback',
    label: '3 新鮮事｜冷知識 (NEWS_FIRST_FACT_FALLBACK)',
  },
  {
    value: 'news_first_fact_or_humor_fallback',
    label: '4 新鮮事→冷知識→日常',
  },
  { value: 'alternate', label: '（遺留）兩種交替 — 不自動升級' },
  { value: 'off', label: '5 先不用 (OFF)' },
  { value: 'unset', label: '未設定 (UNSET)' },
];

export function DryRunPreviewPanel({ defaultTaipeiDate }: { defaultTaipeiDate: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MorningDryRunPreviewResult | null>(null);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Preview 單筆 dry-run</p>
        <Badge variant="destructive" className="font-normal">
          測試用途
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        只讀／寫 Preview DB。測試會員請用 <Code>U_TEST_</Code> 開頭的 LINE ID（會明顯標記）。
        非測試 ID 不會寫入 preference（禁止替正式會員擴張 consent）。不真送 LINE；sender call
        count 必須為 0。
      </p>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const r = await runMorningDryRunPreviewAction(fd);
              setResult(r);
            } catch (err) {
              setResult(null);
              setError(err instanceof Error ? err.message : 'dry-run 失敗');
            }
          });
        }}
      >
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">測試 LINE user id</span>
          <input
            name="lineUserId"
            required
            placeholder="U_TEST_preview_001"
            className="h-9 w-full rounded-md border px-2 text-sm"
            defaultValue="U_TEST_preview_001"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">contentMode</span>
          <select
            name="contentMode"
            className="h-9 w-full rounded-md border px-2 text-sm"
            defaultValue="jokes"
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">frequency</span>
          <select
            name="frequency"
            className="h-9 w-full rounded-md border px-2 text-sm"
            defaultValue="daily"
          >
            <option value="daily">每天</option>
            <option value="weekday">平日</option>
            <option value="weekly">每週</option>
            <option value="off">先不用</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Taipei date</span>
          <input
            name="taipeiDate"
            required
            pattern="\d{4}-\d{2}-\d{2}"
            defaultValue={defaultTaipeiDate}
            className="h-9 w-full rounded-md border px-2 text-sm font-mono"
          />
        </label>
        <label className="flex items-start gap-2 sm:col-span-2 text-xs">
          <input
            type="checkbox"
            name="confirmTestPreview"
            value="1"
            required
            className="mt-0.5"
          />
          <span>
            我確認這是 Preview 測試，不會批次改正式會員 consent，也不會真送 LINE。
          </span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? '試跑中…' : '執行 dry-run'}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-md border p-3 text-xs">
          <div className="flex flex-wrap gap-2">
            {result.testMember ? (
              <Badge variant="destructive">【測試會員】U_TEST_*</Badge>
            ) : (
              <Badge variant="secondary">非測試 ID（未寫 preference）</Badge>
            )}
            <Badge variant="outline">domain {result.domainMode}</Badge>
            <Badge variant="outline">sender calls {result.senderCallCount}</Badge>
          </div>
          <dl className="grid gap-1.5 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">SELECTED contentType</dt>
              <dd className="font-mono">{result.selectedContentType ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SKIPPED reason</dt>
              <dd className="font-mono">{result.skipReason ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">outcome</dt>
              <dd className="font-mono">{result.plan.outcome}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">idempotency</dt>
              <dd>
                {result.idempotency.alreadyDelivered
                  ? 'ALREADY（不重複）'
                  : result.idempotency.created
                    ? '新建 delivery'
                    : '未新建'}
                {result.idempotency.deliveryId
                  ? ` · ${result.idempotency.deliveryId.slice(0, 8)}…`
                  : ''}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">來源</dt>
              <dd className="break-all">{result.sourceSummary ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">ANIMAL_FACT 揭露句</dt>
              <dd>
                {result.disclosurePresent == null
                  ? '—'
                  : result.disclosurePresent
                    ? '有（今天不是新聞…）'
                    : '無／非 FACT'}
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-muted-foreground mb-1">Renderer 預覽</p>
            <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-[11px] leading-relaxed">
              {result.rendererPreview ?? '（無正文）'}
            </pre>
          </div>
          {result.notes.length ? (
            <ul className="list-disc pl-4 text-muted-foreground">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1 font-mono text-[11px]">{children}</code>;
}
