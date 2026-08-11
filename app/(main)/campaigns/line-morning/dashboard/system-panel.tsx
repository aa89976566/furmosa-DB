import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import {
  labelCountryPriority,
  labelEnabled,
  labelPetTag,
  labelRegion,
  labelRiskLevel,
  labelUsagePolicy,
} from '@/lib/line/morning/admin-labels';
import { renderNewsMessage } from '@/lib/line/morning/renderer';
import type { MorningNewsRecord } from '@/lib/line/morning/news/provider';
import { TRANSACTIONAL_COVERAGE_NOTES } from '@/lib/line/morning/transactional';
import { maskLineUserId } from '@/lib/line/morning/plan/mask';
import {
  ensureMorningFixturesAction,
  refreshMorningNewsPreviewAction,
  setMorningDailyQuotaAction,
  setMorningMasterEnabledAction,
} from '../actions';
import { ConfirmSubmitButton } from './confirm-submit';
import { CodeHint, PreviewSafetyBadges, SourceLink, StatusLabel } from './shared';

type DeliveryRow = {
  id: string;
  createdAt: Date;
  taipeiDate: string;
  lineUserId: string;
  status: string;
  skipReason: string | null;
  renderedText: string | null;
  slotMinute: number;
};

type SourceRow = {
  sourceId: string;
  sourceName: string;
  countryPriority: string;
  enabled: boolean;
  usagePolicy: string;
  verifiedAt: string;
};

type IngestRun = {
  id: string;
  createdAt: Date;
  fetchedCount: number;
  passedCount: number;
  blockedCount: number;
  duplicateCount: number;
  staleCount: number;
};

type NewsItem = {
  id: string;
  title: string;
  status: string;
  sourceName: string;
  sourceId: string | null;
  region: string;
  riskLevel: string;
  confidence: number;
  gateReasons: string;
  canonicalUrl: string;
};

export function SystemPanel(props: {
  taipeiDate: string;
  masterEnabled: boolean;
  dailyQuota: number;
  usedToday: number;
  activeCount: number;
  prefCount: number;
  approvedCount: number;
  draftCount: number;
  draftSpecies: string[];
  liveEnabledCount: number;
  sources: SourceRow[];
  lastIngest: IngestRun | null;
  newsItems: NewsItem[];
  newsPreview: MorningNewsRecord[];
  deliveries: DeliveryRow[];
  transactionalNotes?: readonly string[];
}) {
  const {
    taipeiDate,
    masterEnabled,
    dailyQuota,
    usedToday,
    activeCount,
    prefCount,
    approvedCount,
    draftCount,
    draftSpecies,
    liveEnabledCount,
    sources,
    lastIngest,
    newsItems,
    newsPreview,
    deliveries,
  } = props;
  const txNotes = props.transactionalNotes ?? TRANSACTIONAL_COVERAGE_NOTES;

  const alerts: string[] = [];
  if (liveEnabledCount !== 0) {
    alerts.push(`警示：live enabled 來源數為 ${liveEnabledCount}（預期 0）`);
  }
  if (!masterEnabled) {
    alerts.push('總開關目前關閉（Preview 預設；不會正式發送）');
  }
  if (!lastIngest) {
    alerts.push('尚無 fixture ingest 紀錄');
  }

  return (
    <div
      role="tabpanel"
      id="morning-panel-system"
      aria-labelledby="morning-tab-system"
      className="space-y-4"
    >
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">系統狀態</h2>
            <PreviewSafetyBadges />
          </div>

          <div
            className="rounded-lg border p-3"
            role="status"
            aria-label="健康摘要"
          >
            <p className="font-medium">健康摘要</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                總開關：
                <Badge
                  variant={masterEnabled ? 'default' : 'secondary'}
                  className="ml-1"
                >
                  {masterEnabled ? '開啟' : '關閉'}
                </Badge>
              </li>
              <li>
                今日試跑／配額：{usedToday}／{dailyQuota}（{taipeiDate}）
              </li>
              <li>
                活躍訂閱估 {activeCount}／偏好列 {prefCount}；已核准笑話{' '}
                {approvedCount}、草稿 {draftCount}
                {draftSpecies.length
                  ? `（物種：${draftSpecies.map((t) => labelPetTag(t)).join('、')}）`
                  : ''}
              </li>
              <li>
                實際網路啟用數：{liveEnabledCount}
                <CodeHint> live enabled</CodeHint>
                （本階段應為 0）
              </li>
            </ul>
            {alerts.length ? (
              <ul className="mt-3 space-y-1 text-sm" aria-label="警示">
                {alerts.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden="true">⚠</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                <span aria-hidden="true">✓ </span>
                無額外警示
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <ConfirmSubmitButton
              action={setMorningMasterEnabledAction}
              hiddenFields={{ enabled: masterEnabled ? '0' : '1' }}
              triggerLabel={masterEnabled ? '關閉總開關' : '開啟總開關'}
              title={masterEnabled ? '確認關閉總開關？' : '確認開啟總開關？'}
              description="只影響 Preview 驗收設定，不會發送真實 LINE。取消則不寫入。"
              confirmLabel={masterEnabled ? '確認關閉' : '確認開啟'}
              capability="capability-master-switch"
            />
            <form
              action={setMorningDailyQuotaAction}
              className="flex items-center gap-2"
              data-capability="capability-daily-quota"
            >
              <label className="sr-only" htmlFor="morning-daily-quota">
                每日配額
              </label>
              <input
                id="morning-daily-quota"
                name="dailyQuota"
                type="number"
                min={0}
                max={10000}
                defaultValue={dailyQuota}
                className="h-9 w-24 rounded-md border px-2 text-sm"
              />
              <Button type="submit" size="sm" variant="outline">
                更新配額
              </Button>
            </form>
            <div data-capability="capability-fixture-load">
              <form action={ensureMorningFixturesAction}>
                <Button type="submit" size="sm" variant="secondary">
                  載入草稿範例
                </Button>
              </form>
            </div>
            <ConfirmSubmitButton
              action={refreshMorningNewsPreviewAction}
              triggerLabel="Preview 刷新新聞閘門"
              triggerVariant="default"
              title="確認刷新新聞閘門？"
              description="將以 fixture 重新跑 normalize／gate 並寫入 Preview 資料，不打 live 網路、不真送 LINE。取消則不寫入。"
              confirmLabel="確認刷新"
              capability="capability-fixture-refresh"
            />
          </div>
        </CardContent>
      </Card>

      <details className="rounded-lg border p-4 text-sm" data-capability="capability-source-health">
        <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          來源授權與健康（展開）
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">
            實際網路啟用數：{liveEnabledCount}
            <CodeHint> live enabled</CodeHint>
          </p>
          <div className="space-y-3 md:hidden">
            {sources.map((s) => (
              <div key={s.sourceId} className="rounded-lg border p-3">
                <div className="font-medium break-words">{s.sourceName}</div>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">來源代碼</dt>
                    <dd className="break-all font-mono">{s.sourceId}</dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">優先地區</span>
                    <span>
                      {labelCountryPriority(s.countryPriority)}{' '}
                      <CodeHint>{s.countryPriority}</CodeHint>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">啟用</span>
                    <Badge variant={s.enabled ? 'default' : 'secondary'}>
                      {labelEnabled(s.enabled)}
                    </Badge>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">授權</dt>
                    <dd>
                      {labelUsagePolicy(s.usagePolicy)}{' '}
                      <CodeHint>{s.usagePolicy}</CodeHint>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">查驗日期</dt>
                    <dd>{s.verifiedAt}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">來源代碼</th>
                  <th className="px-2 py-1">優先地區</th>
                  <th className="px-2 py-1">啟用</th>
                  <th className="px-2 py-1">授權</th>
                  <th className="px-2 py-1">查驗</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.sourceId} className="border-t align-top">
                    <td className="px-2 py-1">
                      <div>{s.sourceName}</div>
                      <CodeHint>{s.sourceId}</CodeHint>
                    </td>
                    <td className="px-2 py-1">
                      {labelCountryPriority(s.countryPriority)}{' '}
                      <CodeHint>{s.countryPriority}</CodeHint>
                    </td>
                    <td className="px-2 py-1">
                      <Badge variant={s.enabled ? 'default' : 'secondary'}>
                        {labelEnabled(s.enabled)}
                      </Badge>
                    </td>
                    <td className="px-2 py-1">
                      {labelUsagePolicy(s.usagePolicy)}
                      <div>
                        <CodeHint>{s.usagePolicy}</CodeHint>
                      </div>
                    </td>
                    <td className="px-2 py-1">{s.verifiedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lastIngest ? (
            <p className="text-muted-foreground">
              最近抓取（fixture）：{formatDateTime(lastIngest.createdAt)} · 擷取{' '}
              {lastIngest.fetchedCount}／通過 {lastIngest.passedCount}／阻擋{' '}
              {lastIngest.blockedCount}／重複 {lastIngest.duplicateCount}／過期{' '}
              {lastIngest.staleCount}
            </p>
          ) : (
            <p className="text-muted-foreground">尚無 ingest 紀錄。</p>
          )}
        </div>
      </details>

      <details
        className="rounded-lg border p-4 text-sm"
        data-capability="capability-transactional-notes"
      >
        <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          交易覆蓋限制（展開）
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
          {txNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          Preview 不做真實 test send。dry-run：
          <code className="mx-1 break-all font-mono text-xs">
            POST /api/cron/line-morning-dry-run
          </code>
          （需 CRON_SECRET；不在 vercel.json）。
        </p>
      </details>

      <details
        className="rounded-lg border p-4 text-sm"
        data-capability="capability-news-items"
      >
        <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          已寫入新聞列（展開）
        </summary>
        <div className="mt-3 space-y-3">
          {newsItems.length === 0 ? (
            <p className="text-muted-foreground" role="status">
              尚無新聞列
            </p>
          ) : (
            newsItems.map((n) => (
              <article key={n.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <StatusLabel code={n.status} />
                  <span className="text-xs">
                    {labelRegion(n.region)} <CodeHint>{n.region}</CodeHint>
                  </span>
                </div>
                <p className="mt-2 font-medium break-words">{n.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.sourceName} · 信心 {n.confidence} · {labelRiskLevel(n.riskLevel)}
                </p>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    typed reasons／技術代碼
                  </summary>
                  <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">
                    {n.gateReasons}
                  </p>
                  <CodeHint>{n.sourceId}</CodeHint>
                </details>
                <div className="mt-2">
                  <SourceLink
                    url={n.canonicalUrl}
                    approved={n.status === 'AUTO_APPROVED'}
                  />
                </div>
              </article>
            ))
          )}
        </div>
      </details>

      <details
        className="rounded-lg border p-4 text-sm"
        data-capability="capability-fixture-gate"
      >
        <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Fixture 閘門即時預覽（展開）
        </summary>
        <div className="mt-3 space-y-3">
          {newsPreview.map((n) => {
            const preview =
              n.status === 'AUTO_APPROVED'
                ? renderNewsMessage({
                    factSummary: n.factSummary,
                    barkLine: n.barkLine,
                    sourceName: n.sourceName,
                    canonicalUrl: n.canonicalUrl,
                  })
                : null;
            return (
              <article key={n.fingerprint} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <StatusLabel code={n.status} />
                  <span className="text-xs">
                    {labelRiskLevel(n.riskLevel)} · {labelRegion(n.region)}
                  </span>
                </div>
                <p className="mt-2 font-medium break-words">{n.title}</p>
                {preview ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                    {preview.text}
                  </p>
                ) : (
                  <p className="mt-1 break-words text-muted-foreground">
                    {n.factSummary}
                  </p>
                )}
                <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">
                  {n.safetyReasons.join(', ')}
                </p>
                <div className="mt-2">
                  <SourceLink
                    url={n.canonicalUrl}
                    approved={n.status === 'AUTO_APPROVED'}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </details>

      <details
        className="rounded-lg border p-4 text-sm"
        data-capability="capability-delivery-logs"
      >
        <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          delivery／plan logs（展開；LINE id 已遮罩）
        </summary>
        <div className="mt-3 space-y-3">
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground" role="status">
              尚無 delivery 紀錄
            </p>
          ) : (
            deliveries.map((d) => (
              <article key={d.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <StatusLabel code={d.status} />
                  <span className="text-xs tabular-nums">
                    時段 08:{String(d.slotMinute).padStart(2, '0')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(d.createdAt)} · {d.taipeiDate}
                </p>
                <CodeHint>{maskLineUserId(d.lineUserId)}</CodeHint>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs">
                  {d.skipReason ? (
                    <span className="text-muted-foreground">{d.skipReason}</span>
                  ) : (
                    d.renderedText ?? '—'
                  )}
                </p>
              </article>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
