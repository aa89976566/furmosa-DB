import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { listMorningContents, type MorningContentRow } from '@/lib/line/morning/content';
import { listRecentDeliveries } from '@/lib/line/morning/delivery';
import { getMorningSettings, countDeliveriesToday } from '@/lib/line/morning/settings';
import { morningTaipeiDate } from '@/lib/line/morning/schedule';
import {
  processCandidates,
  type MorningNewsRecord,
} from '@/lib/line/morning/news/provider';
import { defaultMockNewsProvider } from '@/lib/line/morning/news/mock-feed';
import { MORNING_SOURCE_REGISTRY } from '@/lib/line/morning/news/registry';
import { buildMorningOptinPreview } from '@/lib/line/morning/optin-preview';
import { buildMorningPlanPreview } from '@/lib/line/morning/plan-preview';
import {
  buildTodayPlanSummaryView,
  parseMorningDashboardTab,
  tallyPreferenceFrequencies,
  type MorningDashboardTab,
} from '@/lib/line/morning/hq';
import { MorningDashboardTabNav } from './dashboard/tab-nav';
import { TodayPanel } from './dashboard/today-panel';
import { ContentPanel } from './dashboard/content-panel';
import { PreferencesPanel } from './dashboard/preferences-panel';
import { SystemPanel } from './dashboard/system-panel';

type DeliveryRow = Awaited<ReturnType<typeof listRecentDeliveries>>[number];
type MorningSettingsView = Awaited<ReturnType<typeof getMorningSettings>>;

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['admin', 'staff']);

export default async function LineMorningAdminPage({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] };
}) {
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

  const activeTab: MorningDashboardTab = parseMorningDashboardTab(
    searchParams?.tab,
  );

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
    fetchedCount: number;
    passedCount: number;
    blockedCount: number;
    duplicateCount: number;
    staleCount: number;
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
    canonicalUrl: string;
  }> = [];
  let preferenceFreqRows: Array<{ frequency: string }> = [];
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
    preferenceFreqRows = await prisma.lineMorningPreference.findMany({
      select: { frequency: true },
    });
    newsPreview = processCandidates(await defaultMockNewsProvider.fetchCandidates());
    ingestRuns = await prisma.lineMorningIngestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        fetchedCount: true,
        passedCount: true,
        blockedCount: true,
        duplicateCount: true,
        staleCount: true,
      },
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
        canonicalUrl: true,
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

  const optinPreview = buildMorningOptinPreview({
    currentStorageMode: 'alternate',
    contentActionId: 'content_c',
    frequencyActionId: 'freq_friday',
  });
  const frequencyStats = tallyPreferenceFrequencies(preferenceFreqRows);

  let planPreview: Awaited<ReturnType<typeof buildMorningPlanPreview>> | null =
    null;
  let planPreviewError: string | null = null;
  let lastPlanCheckedAt: string | null = null;
  try {
    planPreview = await buildMorningPlanPreview({ limit: 30 });
    if (planPreview.rows.length > 0) {
      const latest = await prisma.lineMorningPlanLedger.findFirst({
        where: { runDate: planPreview.runDate },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      lastPlanCheckedAt = latest?.createdAt.toISOString() ?? null;
    }
  } catch (e) {
    planPreviewError = e instanceof Error ? e.message : String(e);
  }

  const todaySummary = buildTodayPlanSummaryView(planPreview, {
    lastCheckedAt: lastPlanCheckedAt,
  });

  return (
    <>
      <PageHeader
        title="壽司匠早安"
        description="Preview 驗收：結構零發送。不做真實 LINE 發送，不進 Production cron。"
      />
      <div className="max-w-full space-y-4 overflow-x-hidden p-4 sm:p-6">
        {schemaError ? (
          <Card>
            <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>早安資料表可能尚未套用 migration。</p>
              <p className="break-all font-mono text-xs text-destructive/80">
                {schemaError}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">返回 Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <MorningDashboardTabNav activeTab={activeTab} />

        {activeTab === 'today' ? (
          <TodayPanel
            summary={todaySummary}
            planPreview={planPreview}
            planPreviewError={planPreviewError}
            taipeiDate={taipeiDate}
          />
        ) : null}

        {activeTab === 'content' ? <ContentPanel contents={contents} /> : null}

        {activeTab === 'preferences' ? (
          <PreferencesPanel
            optinPreview={optinPreview}
            frequencyStats={frequencyStats}
            activeCount={activeCount}
            prefCount={prefCount}
          />
        ) : null}

        {activeTab === 'system' ? (
          <SystemPanel
            taipeiDate={taipeiDate}
            masterEnabled={settings.masterEnabled}
            dailyQuota={settings.dailyQuota}
            usedToday={usedToday}
            activeCount={activeCount}
            prefCount={prefCount}
            approvedCount={approvedCount}
            draftCount={draftCount}
            draftSpecies={draftSpecies}
            liveEnabledCount={liveEnabledCount}
            sources={MORNING_SOURCE_REGISTRY.map((s) => ({
              sourceId: s.sourceId,
              sourceName: s.sourceName,
              countryPriority: s.countryPriority,
              enabled: s.enabled,
              usagePolicy: s.usagePolicy,
              verifiedAt: s.verifiedAt,
            }))}
            lastIngest={lastIngest}
            newsItems={newsItems}
            newsPreview={newsPreview}
            deliveries={deliveries}
          />
        ) : null}
      </div>
    </>
  );
}
