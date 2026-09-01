import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { OmsDashboard } from '@/components/orders/oms-dashboard';
import { DashboardBodyFallback, DashboardBodySection, DashboardTasksFallback } from './dashboard-stream';

export const dynamic = 'force-dynamic';

type DashboardPageProps = { searchParams: { view?: string } };

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  const insights = searchParams.view === 'insights';
  return <>
    <PageHeader tone="overview" title="營運首頁"
      description={insights ? '看懂近期營運變化，需要時再深入完整報表。' : '先完成今天最重要的工作，系統會告訴你下一步。'}
      actions={<Button size="sm" asChild><Link href="/orders/new"><Plus className="mr-1 h-4 w-4" />新增訂單</Link></Button>} />
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-7">
      <nav aria-label="Dashboard 顯示模式" className="inline-flex rounded-xl bg-muted/70 p-1">
        <Link href="/dashboard" className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!insights ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>今日工作</Link>
        <Link href="/dashboard?view=insights" className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${insights ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>營運數據</Link>
      </nav>
      {insights
        ? <Suspense fallback={<DashboardBodyFallback />}><DashboardBodySection /></Suspense>
        : <Suspense fallback={<DashboardTasksFallback />}><OmsDashboard /></Suspense>}
    </main>
  </>;
}
