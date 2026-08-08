import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import {
  CONTENT_MODE_LABELS,
  FREQUENCY_LABELS,
} from '@/lib/line/morning/copy';
import {
  isFixtureCanonicalUrl,
  labelCountryPriority,
  labelEnabled,
  labelNewsStatus,
  labelPetTag,
  labelRegion,
  labelRiskLevel,
  labelUsagePolicy,
} from '@/lib/line/morning/admin-labels';
import { listMorningContents, type MorningContentRow } from '@/lib/line/morning/content';
import { listRecentDeliveries } from '@/lib/line/morning/delivery';
import { renderJokeMessage, renderNewsMessage } from '@/lib/line/morning/renderer';
import { getMorningSettings, countDeliveriesToday } from '@/lib/line/morning/settings';
import { morningTaipeiDate } from '@/lib/line/morning/schedule';
import { TRANSACTIONAL_COVERAGE_NOTES } from '@/lib/line/morning/transactional';
import {
  processCandidates,
  type MorningNewsRecord,
} from '@/lib/line/morning/news/provider';
import { defaultMockNewsProvider } from '@/lib/line/morning/news/mock-feed';
import { MORNING_SOURCE_REGISTRY } from '@/lib/line/morning/news/registry';
import {
  ensureMorningFixturesAction,
  refreshMorningNewsPreviewAction,
  setMorningDailyQuotaAction,
  setMorningMasterEnabledAction,
  updateMorningContentStatusAction,
} from './actions';

type DeliveryRow = Awaited<ReturnType<typeof listRecentDeliveries>>[number];
type MorningSettingsView = Awaited<ReturnType<typeof getMorningSettings>>;

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['admin', 'staff']);

const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  APPROVED: 'default',
  ARCHIVED: 'outline',
  AUTO_APPROVED: 'default',
  BLOCKED: 'destructive',
  REVIEW_REQUIRED: 'secondary',
  DRY_RUN: 'outline',
  SKIPPED: 'secondary',
  SENT: 'default',
  FAILED: 'destructive',
};

function StatusLabel({ code }: { code: string }) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Badge variant={STATUS_TONE[code] ?? 'outline'} className="w-fit">
        {labelNewsStatus(code)}
      </Badge>
      <span className="font-mono text-[10px] text-muted-foreground">{code}</span>
    </span>
  );
}

function CodeHint({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] text-muted-foreground">{children}</span>;
}

function SourceLink({ url, approved }: { url: string; approved: boolean }) {
  if (!approved) {
    return (
      <p className="text-xs text-muted-foreground break-all">
        已阻擋項目不提供來源導引
        {isFixtureCanonicalUrl(url) ? (
          <span className="mt-0.5 block">Fixture 占位：{url}</span>
        ) : null}
      </p>
    );
  }
  const fixture = isFixtureCanonicalUrl(url);
  return (
    <div className="space-y-1 text-xs">
      {fixture ? (
        <Badge variant="outline" className="font-normal">
          Fixture 占位（非真新聞）
        </Badge>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex break-all text-primary underline underline-offset-2"
      >
        查看原始來源
      </a>
      <CodeHint>{url}</CodeHint>
    </div>
  );
}

function ContentActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {status !== 'APPROVED' ? (
        <form action={updateMorningContentStatusAction}>
          <input type="hidden" name="contentId" value={id} />
          <input type="hidden" name="status" value="APPROVED" />
          <Button type="submit" size="sm" variant="outline">
            核准
          </Button>
        </form>
      ) : null}
      {status !== 'DRAFT' ? (
        <form action={updateMorningContentStatusAction}>
          <input type="hidden" name="contentId" value={id} />
          <input type="hidden" name="status" value="DRAFT" />
          <Button type="submit" size="sm" variant="ghost">
            回草稿
          </Button>
        </form>
      ) : null}
      {status !== 'ARCHIVED' ? (
        <form action={updateMorningContentStatusAction}>
          <input type="hidden" name="contentId" value={id} />
          <input type="hidden" name="status" value="ARCHIVED" />
          <Button type="submit" size="sm" variant="ghost">
            封存
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export default async function LineMorningAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!ALLOWED_ROLES.has(user.role)) {
    return (
      <>
        <PageHeader title="壽司匠早安" description="權限不足" />
        <div className="p-6 text-sm text-muted-foreground">需要 admin 或 staff 角色。</div>
      </>
    );
  }

  const taipeiDate = morningTaipeiDate();
  let settings: MorningSettingsView = {
    masterEnabled: false,
    dailyQuota: 100,
    updatedBy: null,
  };
  let contents: MorningContentRow[] = [];
  let deliveries: DeliveryRow[] = [];
  let prefCount = 0;
  let activeCount = 0;
  let usedToday = 0;
  let newsPreview: MorningNewsRecord[] = [];
  let ingestRuns: Array<{
    id: string;
    createdAt: Date;
    masterEnabled: boolean;
    fetchedCount: number;
    passedCount: number;
    blockedCount: number;
    duplicateCount: number;
    staleCount: number;
    summaryJson: string;
    createdBy: string | null;
  }> = [];
  let newsItems: Array<{
    id: string;
    title: string;
    status: string;
    sourceName: string;
    sourceId: string | null;
    region: string;
    riskLevel: string;
    confidence: number;
    gateReasons: string;
    contentHash: string | null;
    canonicalUrl: string;
    publishedAt: Date;
  }> = [];
  let schemaError: string | null = null;

  try {
    settings = await getMorningSettings();
    contents = await listMorningContents({ take: 50 });
    deliveries = await listRecentDeliveries({ take: 40 });
    usedToday = await countDeliveriesToday(taipeiDate);
    prefCount = await prisma.lineMorningPreference.count();
    activeCount = await prisma.lineMorningPreference.count({
      where: {
        pausedAt: null,
        contentMode: { notIn: ['off', 'unset'] },
        frequency: { notIn: ['off', 'unset'] },
      },
    });
    newsPreview = processCandidates(await defaultMockNewsProvider.fetchCandidates());
    ingestRuns = await prisma.lineMorningIngestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    newsItems = await prisma.lineMorningNewsItem.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        sourceName: true,
        sourceId: true,
        region: true,
        riskLevel: true,
        confidence: true,
        gateReasons: true,
        contentHash: true,
        canonicalUrl: true,
        publishedAt: true,
      },
    });
  } catch (e) {
    schemaError = e instanceof Error ? e.message : String(e);
  }

  const liveEnabledCount = MORNING_SOURCE_REGISTRY.filter((s) => s.enabled).length;
  const lastIngest = ingestRuns[0] ?? null;

  const approvedCount = contents.filter((c) => c.status === 'APPROVED').length;
  const draftCount = contents.filter((c) => c.status === 'DRAFT').length;
  const draftSpecies = [
    ...new Set(
      contents
        .filter((c) => c.status === 'DRAFT')
        .flatMap((c) => c.petTags)
        .filter((t) => t !== 'general'),
    ),
  ];

  return (
    <>
      <PageHeader
        title="壽司匠早安"
        description="14 日 Preview MVP：視覺預覽＋dry-run。不做真實 LINE 發送，不進 Production cron。"
      />
      <div className="max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
        {schemaError ? (
          <Card>
            <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>早安資料表可能尚未套用 migration（20260808060000_line_morning_mvp）。</p>
              <p className="font-mono text-xs break-all text-destructive/80">{schemaError}</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">返回 Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="flex flex-col gap-4 p-4 text-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">總開關</span>
                <Badge variant={settings.masterEnabled ? 'default' : 'secondary'}>
                  {settings.masterEnabled ? '開啟' : '關閉（預設）'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                今日（{taipeiDate}）試跑／送出約 {usedToday}／配額 {settings.dailyQuota}；
                活躍訂閱估 {activeCount}／偏好列 {prefCount}；已核准笑話 {approvedCount}、草稿{' '}
                {draftCount}
                {draftSpecies.length
                  ? `（物種：${draftSpecies.map((t) => labelPetTag(t)).join('、')}）`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={setMorningMasterEnabledAction}>
                <input type="hidden" name="enabled" value={settings.masterEnabled ? '0' : '1'} />
                <Button type="submit" size="sm" variant="outline">
                  {settings.masterEnabled ? '關閉總開關' : '開啟總開關'}
                </Button>
              </form>
              <form action={setMorningDailyQuotaAction} className="flex items-center gap-2">
                <input
                  name="dailyQuota"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={settings.dailyQuota}
                  className="h-9 w-24 rounded-md border px-2 text-sm"
                />
                <Button type="submit" size="sm" variant="outline">
                  更新配額
                </Button>
              </form>
              <form action={ensureMorningFixturesAction}>
                <Button type="submit" size="sm" variant="secondary">
                  載入草稿範例
                </Button>
              </form>
              <form action={refreshMorningNewsPreviewAction}>
                <Button type="submit" size="sm" variant="default">
                  Preview 刷新新聞閘門
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <p className="font-medium">來源健康（來源登錄）</p>
            <p className="text-muted-foreground">
              實際網路啟用數：{liveEnabledCount}
              <CodeHint> live enabled</CodeHint>
              （本階段應為 0；未商業授權禁止網路存取）
            </p>

            {/* Mobile: stacked cards */}
            <div className="space-y-3 md:hidden">
              {MORNING_SOURCE_REGISTRY.map((s) => (
                <div key={s.sourceId} className="rounded-lg border p-3">
                  <div className="font-medium break-words">{s.sourceName}</div>
                  <dl className="mt-2 space-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">來源代碼</dt>
                      <dd className="font-mono break-all">{s.sourceId}</dd>
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
                      <CodeHint>{s.enabled ? 'enabled=true' : 'enabled=false'}</CodeHint>
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

            {/* Desktop: table */}
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
                  {MORNING_SOURCE_REGISTRY.map((s) => (
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
                {lastIngest.passedCount === 0
                  ? ' · 今天沒有通過安全檢查的新鮮事'
                  : null}
              </p>
            ) : (
              <p className="text-muted-foreground">尚無 ingest 紀錄，請按「Preview 刷新新聞閘門」。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">交易通知優先覆蓋範圍</p>
            <ul className="list-disc space-y-1 pl-5">
              {TRANSACTIONAL_COVERAGE_NOTES.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p>
              Preview 不做真實 test send。dry-run：
              <code className="mx-1 font-mono text-xs break-all">
                POST /api/cron/line-morning-dry-run
              </code>
              （需 CRON_SECRET；不在 vercel.json）。
            </p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">內容庫（正式 renderer 預覽）</h2>

          <div className="space-y-3 md:hidden">
            {contents.length === 0 ? (
              <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
                尚無內容。可按「載入草稿範例」。
              </p>
            ) : (
              contents.map((c) => {
                const preview = renderJokeMessage({ body: c.body });
                return (
                  <div key={c.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <StatusLabel code={c.status} />
                      <div className="text-xs text-muted-foreground">
                        {c.petTags.map((t) => labelPetTag(t)).join('、') || '—'}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words">{preview.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {preview.charCount} 字
                      {preview.truncated ? '（已截）' : ''}
                    </p>
                    <CodeHint>{c.stableId}</CodeHint>
                    <div className="mt-2">
                      <ContentActions id={c.id} status={c.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">穩定代碼</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">預覽</th>
                  <th className="px-3 py-2">物種標籤</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {contents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      尚無內容。可按「載入草稿範例」。
                    </td>
                  </tr>
                ) : (
                  contents.map((c) => {
                    const preview = renderJokeMessage({ body: c.body });
                    return (
                      <tr key={c.id} className="border-t align-top">
                        <td className="px-3 py-2 font-mono text-xs">{c.stableId}</td>
                        <td className="px-3 py-2">
                          <StatusLabel code={c.status} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="max-w-md whitespace-pre-wrap">{preview.text}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {preview.charCount} 字
                            {preview.truncated ? '（已截）' : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {c.petTags.map((t) => labelPetTag(t)).join('、') || '—'}
                          <div>
                            <CodeHint>{c.petTags.join(', ') || '—'}</CodeHint>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <ContentActions id={c.id} status={c.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">已寫入新聞列（含阻擋原因）</h2>

          <div className="space-y-3 md:hidden">
            {newsItems.length === 0 ? (
              <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
                尚無新聞列
              </p>
            ) : (
              newsItems.map((n) => (
                <div key={n.id} className="rounded-xl border p-3 text-sm">
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
                  <div className="mt-1">
                    <CodeHint>{n.sourceId}</CodeHint>
                  </div>
                  <p className="mt-2 text-xs">
                    <span className="text-muted-foreground">判定原因</span>
                    <span className="mt-0.5 block break-words font-mono text-[11px] text-muted-foreground">
                      {n.gateReasons}
                    </span>
                  </p>
                  <div className="mt-2">
                    <SourceLink url={n.canonicalUrl} approved={n.status === 'AUTO_APPROVED'} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">來源／地區</th>
                  <th className="px-3 py-2">標題與來源連結</th>
                  <th className="px-3 py-2">信心</th>
                  <th className="px-3 py-2">判定原因</th>
                </tr>
              </thead>
              <tbody>
                {newsItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      尚無新聞列
                    </td>
                  </tr>
                ) : (
                  newsItems.map((n) => (
                    <tr key={n.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <StatusLabel code={n.status} />
                        <div className="mt-1 text-xs">
                          {labelRiskLevel(n.riskLevel)}{' '}
                          <CodeHint>{n.riskLevel}</CodeHint>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{n.sourceName}</div>
                        <CodeHint>{n.sourceId}</CodeHint>
                        <div className="mt-1">
                          {labelRegion(n.region)} <CodeHint>{n.region}</CodeHint>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{n.title}</div>
                        <div className="mt-1">
                          <SourceLink
                            url={n.canonicalUrl}
                            approved={n.status === 'AUTO_APPROVED'}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{n.confidence}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {n.gateReasons}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Fixture 閘門即時預覽（非真新聞）</h2>

          <div className="space-y-3 md:hidden">
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
                <div key={n.fingerprint} className="rounded-xl border p-3 text-sm">
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
                    <p className="mt-1 break-words text-muted-foreground">{n.factSummary}</p>
                  )}
                  <div className="mt-2">
                    <SourceLink url={n.canonicalUrl} approved={n.status === 'AUTO_APPROVED'} />
                  </div>
                  <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">
                    {n.safetyReasons.join(', ')}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">風險</th>
                  <th className="px-3 py-2">來源／地區</th>
                  <th className="px-3 py-2">預覽</th>
                  <th className="px-3 py-2">判定原因</th>
                </tr>
              </thead>
              <tbody>
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
                    <tr key={n.fingerprint} className="border-t align-top">
                      <td className="px-3 py-2">
                        <StatusLabel code={n.status} />
                      </td>
                      <td className="px-3 py-2">
                        {labelRiskLevel(n.riskLevel)}{' '}
                        <CodeHint>{n.riskLevel}</CodeHint>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{n.sourceName}</div>
                        <div>
                          {labelRegion(n.region)} <CodeHint>{n.region}</CodeHint>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{n.title}</div>
                        {preview ? (
                          <div className="mt-1 max-w-md whitespace-pre-wrap text-muted-foreground">
                            {preview.text}
                          </div>
                        ) : (
                          <div className="mt-1 text-muted-foreground">{n.factSummary}</div>
                        )}
                        <div className="mt-2">
                          <SourceLink
                            url={n.canonicalUrl}
                            approved={n.status === 'AUTO_APPROVED'}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {n.safetyReasons.join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">近期結果／略過原因</h2>

          <div className="space-y-3 md:hidden">
            {deliveries.length === 0 ? (
              <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
                尚無 delivery 紀錄
              </p>
            ) : (
              deliveries.map((d) => (
                <div key={d.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <StatusLabel code={d.status} />
                    <span className="text-xs tabular-nums">
                      時段 08:{String(d.slotMinute).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(d.createdAt)} · {d.taipeiDate}
                  </p>
                  <CodeHint>{d.lineUserId}</CodeHint>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs">
                    {d.skipReason ? (
                      <span className="text-muted-foreground">{d.skipReason}</span>
                    ) : (
                      d.renderedText ?? '—'
                    )}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">時間</th>
                  <th className="px-3 py-2">日期</th>
                  <th className="px-3 py-2">用戶</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">原因／內容</th>
                  <th className="px-3 py-2">時段</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      尚無 delivery 紀錄
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {formatDateTime(d.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{d.taipeiDate}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{d.lineUserId}</td>
                      <td className="px-3 py-2">
                        <StatusLabel code={d.status} />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {d.skipReason ? (
                          <span className="text-muted-foreground">{d.skipReason}</span>
                        ) : (
                          <span className="whitespace-pre-wrap">{d.renderedText ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        08:{String(d.slotMinute).padStart(2, '0')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground">
            偏好標籤對照：
            {Object.entries(CONTENT_MODE_LABELS)
              .map(([k, v]) => `${v}（${k}）`)
              .join(' · ')}
            ；
            {Object.entries(FREQUENCY_LABELS)
              .map(([k, v]) => `${v}（${k}）`)
              .join(' · ')}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
