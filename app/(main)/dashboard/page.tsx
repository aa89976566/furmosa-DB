import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DashboardSearch } from '@/components/dashboard/dashboard-search';
import { Button } from '@/components/ui/button';
import {
  DashboardBodyFallback,
  DashboardBodySection,
  DashboardTasksFallback,
  DashboardTasksSection,
} from './dashboard-stream';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        tone="overview"
        title="營運概覽"
        description="本月重點數字"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href="/orders/new">新建訂單</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/orders">訂單列表</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-10 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0">
            <DashboardSearch />
          </div>
          <div className="min-w-0">
            <Suspense fallback={<DashboardTasksFallback />}>
              <DashboardTasksSection />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<DashboardBodyFallback />}>
          <DashboardBodySection />
        </Suspense>
      </div>
    </>
  );
}
