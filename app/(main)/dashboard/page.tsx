import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { OmsDashboard } from '@/components/orders/oms-dashboard';
import { getTodayTasksForDashboard } from '@/lib/dashboard-tasks';
import { getDashboardData } from '@/features/dashboard/queries';
import { DashboardBodyFallback, DashboardBodySection, DashboardTasksFallback } from './dashboard-stream';

const WorkbenchEntry = nextDynamic(() => import('@/components/dashboard/workbench-entry').then((module) => module.WorkbenchEntry));

export const dynamic = 'force-dynamic';

type DashboardPageProps = { searchParams: Promise<{ view?: string; role?: string }> };

export default async function DashboardPage(props: DashboardPageProps) {
  const searchParams = await props.searchParams;
  const insights = searchParams.view === 'insights';
  const workbench = process.env.HQ_WORKBENCH_PREVIEW === 'true' && searchParams.view === 'workbench';
  const [todayTasks, dashboardData] = workbench
    ? await Promise.all([getTodayTasksForDashboard(), getDashboardData()])
    : [[], null];
  return <>
    <PageHeader tone="overview" title={workbench ? '角色工作台預覽' : '營運首頁'}
      description={insights ? '看懂近期營運變化，需要時再深入完整報表。' : workbench ? '用自己的工作視角開始今天，資料仍來自同一套 HQ。' : '先完成今天最重要的工作，系統會告訴你下一步。'}
      actions={workbench ? <Button size="sm" variant="outline" asChild><Link href="/dashboard">回到營運首頁</Link></Button> : <Button size="sm" asChild><Link href="/orders/new"><Plus className="mr-1 h-4 w-4" />新增訂單</Link></Button>} />
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-7">
      {insights
        ? <Suspense fallback={<DashboardBodyFallback />}><DashboardBodySection /></Suspense>
        : workbench
          ? <><RoleSwitcher activeRole={searchParams.role} /><WorkbenchEntry initialRole={searchParams.role} initialTasks={todayTasks} kpis={dashboardData?.kpis ?? null} /></>
          : <Suspense fallback={<DashboardTasksFallback />}><OmsDashboard /></Suspense>}
    </main>
  </>;
}

function RoleSwitcher({ activeRole }: { activeRole?: string }) {
  const roles = [
    ['ming', 'Ming'],
    ['cc', 'cc'],
    ['chang-jun', '常峻'],
    ['jia-jun', '佳君'],
    ['jie-xin', '潔心'],
  ];
  return <nav aria-label="切換工作視角" className="flex flex-wrap gap-2">{roles.map(([key, label]) => <Link key={key} href={`/dashboard?view=workbench&role=${key}`} className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${activeRole === key || (!activeRole && key === 'ming') ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}</Link>)}</nav>;
}
