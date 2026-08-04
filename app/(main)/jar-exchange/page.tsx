import {
  JarPlanPosSection,
  JarPlanQuickLinks,
  JarPlanReportSection,
  JarPlanTodaySignupsSection,
} from '@/components/jar-exchange/plan-overview';
import { JarShell } from '@/components/jar-exchange/jar-shell';
import { loadJarPlanOverview } from '@/lib/jar-exchange/plan-overview';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '換罐計劃 · Furmosa HQ',
};

export default async function JarPlanOverviewPage() {
  const data = await loadJarPlanOverview();

  return (
    <JarShell
      pathname="/jar-exchange"
      title="換罐計劃"
      description="LINE 開戶即時進系統。這裡看今日開戶、換罐報告，以及 POS 店家連線。"
    >
      <div className="space-y-6">
        <JarPlanQuickLinks />
        <JarPlanTodaySignupsSection data={data} />
        <JarPlanReportSection data={data} />
        <JarPlanPosSection data={data} />
      </div>
    </JarShell>
  );
}
