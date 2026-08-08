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
import {
  ensureMorningFixturesAction,
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
  } catch (e) {
    schemaError = e instanceof Error ? e.message : String(e);
  }

  const approvedCount = contents.filter((c) => c.status === 'APPROVED').length;
  const draftCount = contents.filter((c) => c.status === 'DRAFT').length;

  return (
    <>
      <PageHeader
        title="壽司匠早安"
        description="14 日 Preview MVP：視覺預覽＋dry-run。不做真實 LINE 發送，不進 Production cron。"
      />
      <div className="space-y-6 p-4 sm:p-6">
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
                  {settings.masterEnabled ? 'ON' : 'OFF（預設）'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                今日（{taipeiDate}）dry-run／送出約 {usedToday}／配額 {settings.dailyQuota}；
                活躍訂閱估 {activeCount}／偏好列 {prefCount}；APPROVED 笑話 {approvedCount}、DRAFT{' '}
                {draftCount}
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
                  載入 DRAFT 範例
                </Button>
              </form>
            </div>
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
              <code className="mx-1 font-mono text-xs">
                POST /api/cron/line-morning-dry-run
              </code>
              （需 CRON_SECRET；不在 vercel.json）。
            </p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">內容庫（正式 renderer 預覽）</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">stableId</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">預覽</th>
                  <th className="px-3 py-2">tags</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {contents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      尚無內容。可按「載入 DRAFT 範例」。
                    </td>
                  </tr>
                ) : (
                  contents.map((c) => {
                    const preview = renderJokeMessage({ body: c.body });
                    return (
                      <tr key={c.id} className="border-t align-top">
                        <td className="px-3 py-2 font-mono text-xs">{c.stableId}</td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_TONE[c.status] ?? 'outline'}>{c.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="max-w-md whitespace-pre-wrap">{preview.text}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {preview.charCount} 字
                            {preview.truncated ? '（已截）' : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{c.petTags.join(', ') || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            {c.status !== 'APPROVED' ? (
                              <form action={updateMorningContentStatusAction}>
                                <input type="hidden" name="contentId" value={c.id} />
                                <input type="hidden" name="status" value="APPROVED" />
                                <Button type="submit" size="sm" variant="outline">
                                  核准
                                </Button>
                              </form>
                            ) : null}
                            {c.status !== 'DRAFT' ? (
                              <form action={updateMorningContentStatusAction}>
                                <input type="hidden" name="contentId" value={c.id} />
                                <input type="hidden" name="status" value="DRAFT" />
                                <Button type="submit" size="sm" variant="ghost">
                                  回草稿
                                </Button>
                              </form>
                            ) : null}
                            {c.status !== 'ARCHIVED' ? (
                              <form action={updateMorningContentStatusAction}>
                                <input type="hidden" name="contentId" value={c.id} />
                                <input type="hidden" name="status" value="ARCHIVED" />
                                <Button type="submit" size="sm" variant="ghost">
                                  封存
                                </Button>
                              </form>
                            ) : null}
                          </div>
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
          <h2 className="text-base font-semibold">新聞 mock feed（安全閘門預覽）</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">風險</th>
                  <th className="px-3 py-2">來源／區</th>
                  <th className="px-3 py-2">預覽</th>
                  <th className="px-3 py-2">原因</th>
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
                        <Badge variant={STATUS_TONE[n.status] ?? 'outline'}>{n.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{n.riskLevel}</td>
                      <td className="px-3 py-2 text-xs">
                        <div>{n.sourceName}</div>
                        <div className="text-muted-foreground">{n.region}</div>
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
          <h2 className="text-base font-semibold">近期結果／skip 原因</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">時間</th>
                  <th className="px-3 py-2">日期</th>
                  <th className="px-3 py-2">用戶</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">原因／內容</th>
                  <th className="px-3 py-2">slot</th>
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
                        <Badge variant={STATUS_TONE[d.status] ?? 'outline'}>{d.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {d.skipReason ? (
                          <span className="text-muted-foreground">{d.skipReason}</span>
                        ) : (
                          <span className="whitespace-pre-wrap">{d.renderedText ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">08:{String(d.slotMinute).padStart(2, '0')}</td>
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
              .map(([k, v]) => `${k}=${v}`)
              .join(' · ')}
            ；
            {Object.entries(FREQUENCY_LABELS)
              .map(([k, v]) => `${k}=${v}`)
              .join(' · ')}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
