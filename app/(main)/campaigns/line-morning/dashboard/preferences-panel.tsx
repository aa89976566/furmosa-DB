import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CONTENT_MODE_LABELS,
  FREQUENCY_LABELS,
} from '@/lib/line/morning/copy';
import type { MorningOptinPreviewResult } from '@/lib/line/morning/optin-preview';
import type { MorningPreferenceFrequencyStats } from '@/lib/line/morning/hq';

export function PreferencesPanel({
  optinPreview,
  frequencyStats,
  activeCount,
  prefCount,
}: {
  optinPreview: MorningOptinPreviewResult;
  frequencyStats: MorningPreferenceFrequencyStats;
  activeCount: number;
  prefCount: number;
}) {
  return (
    <div
      role="tabpanel"
      id="morning-panel-preferences"
      aria-labelledby="morning-tab-preferences"
      className="space-y-4"
      data-capability="capability-optin-preview"
    >
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">會員設定</h2>
            <Badge variant="outline">唯讀 Preview</Badge>
            <Badge variant="secondary">HQ 不代寫 preference</Badge>
          </div>
          <p className="text-muted-foreground">
            會員在 LINE 輸入「早安設定」自行修改或關閉；通常只設定一次。此區與 LINE
            共用同一文案來源，僅供驗收，不會寫入 preference、不會發送。
          </p>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="每天" value={frequencyStats.daily} />
            <Stat label="平日" value={frequencyStats.weekday} />
            <Stat label="週五" value={frequencyStats.weekly} />
            <Stat label="關閉" value={frequencyStats.off} />
            <Stat label="未設定" value={frequencyStats.unset} />
            <Stat label="活躍估／總列" valueLabel={`${activeCount}／${prefCount}`} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <h3 className="font-medium">LINE「早安設定」文案（shared renderer）</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
              {optinPreview.contentPrompt}
            </pre>
            <div className="space-y-2">
              {optinPreview.samplePreview ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
                  {optinPreview.samplePreview}
                  {'\n\n'}
                  {optinPreview.sampleButtons.join(' ／ ')}
                </pre>
              ) : null}
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
                {optinPreview.frequencyPrompt}
              </pre>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
                {optinPreview.summary ?? '（選內容＋頻率後顯示摘要）'}
              </pre>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
                {optinPreview.successSummary ?? '（確認後成功摘要）'}
              </pre>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {optinPreview.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              技術 enum／標籤對照
            </summary>
            <p className="mt-2 text-muted-foreground">
              {Object.entries(CONTENT_MODE_LABELS)
                .map(([k, v]) => `${v}（${k}）`)
                .join(' · ')}
              ；
              {Object.entries(FREQUENCY_LABELS)
                .map(([k, v]) => `${v}（${k}）`)
                .join(' · ')}
            </p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  valueLabel,
}: {
  label: string;
  value?: number;
  valueLabel?: string;
}) {
  return (
    <div className="rounded-md border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {valueLabel ?? value ?? 0}
      </dd>
    </div>
  );
}
