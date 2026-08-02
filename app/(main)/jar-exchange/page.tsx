import {
  JarPlanPosSection,
  JarPlanQuickLinks,
  JarPlanReportSection,
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
      description="一眼看換罐報告、待到店訂單，以及 POS 店家是否有登入連線。"
    >
      <div className="space-y-6">
        <JarPlanQuickLinks />
        <JarPlanReportSection data={data} />
        <JarPlanPosSection data={data} />
      </div>
    </JarShell>
  );
}
