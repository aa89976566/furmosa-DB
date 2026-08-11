import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import type { MorningPlanPreviewResult } from '@/lib/line/morning/plan-preview';
import type { MorningTodayPlanSummaryView } from '@/lib/line/morning/hq';
import { PlanGenerateForm } from './plan-generate-form';
import { PreviewSafetyBadges } from './shared';

export function TodayPanel({
  summary,
  planPreview,
  planPreviewError,
  taipeiDate,
}: {
  summary: MorningTodayPlanSummaryView;
  planPreview: MorningPlanPreviewResult | null;
  planPreviewError: string | null;
  taipeiDate: string;
}) {
  return (
    <div
      role="tabpanel"
      id="morning-panel-today"
      aria-labelledby="morning-tab-today"
      className="space-y-4"
    >
      <Card>
        <CardContent className="space-y-4 p-4 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-base font-semibold">今日早安</h2>
              <PreviewSafetyBadges />
              <p className="text-muted-foreground">
                Asia/Taipei 日期：
                <span className="ml-1 font-medium text-foreground">
                  {summary.runDate || taipeiDate}
                </span>
              </p>
            </div>
            <PlanGenerateForm initialLastCheckedAt={summary.lastCheckedAt} />
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="預計產生" value={summary.plannedCount} />
            <Stat label="略過" value={summary.skippedCount} />
            <Stat label="異常" value={summary.anomalyCount} />
            <Stat label="交易讓路" value={summary.transactionalSuppressedCount} />
            <div className="col-span-2 rounded-md border p-2 sm:col-span-1">
              <dt className="text-xs text-muted-foreground">最後檢查</dt>
              <dd className="mt-1 text-xs font-medium">
                {summary.lastCheckedAt
                  ? formatDateTime(new Date(summary.lastCheckedAt))
                  : '尚未檢查'}
              </dd>
            </div>
          </dl>

          {planPreviewError ? (
            <p className="text-sm text-destructive" role="alert">
              無法載入今日 plan：請稍後再試
              <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                {planPreviewError}
              </span>
            </p>
          ) : null}

          <section className="space-y-2" aria-labelledby="today-copy-heading">
            <h3 id="today-copy-heading" className="font-medium">
              今日實際會員文案預覽
            </h3>
            {!planPreview || planPreview.rows.length === 0 ? (
              <div
                className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
                role="status"
              >
                <p className="font-medium text-foreground">目前沒有可預覽的文案</p>
                <p className="mt-1">
                  若尚未檢查，請按「重新產生預覽計畫」。若檢查後仍為 0，代表目前沒有符合條件的會員。
                </p>
              </div>
            ) : (
              <div className="max-h-96 space-y-2 overflow-auto rounded-md border p-2">
                {planPreview.rows.map((r) => (
                  <article
                    key={`${r.maskedLineUserId}-${r.decisionReason}-${r.planStatus}`}
                    className="rounded border bg-muted/20 p-2 text-xs"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="font-mono">{r.maskedLineUserId}</span>
                      <Badge variant="outline">{r.planStatus}</Badge>
                      <span className="text-muted-foreground">{r.decisionReason}</span>
                      {r.contentType ? (
                        <span className="text-muted-foreground">{r.contentType}</span>
                      ) : null}
                    </div>
                    {r.contentPreview ? (
                      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[11px]">
                        {r.contentPreview}
                      </pre>
                    ) : (
                      <p className="mt-1 text-muted-foreground">（略過：無文案）</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
