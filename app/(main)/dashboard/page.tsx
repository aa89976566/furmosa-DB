import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DashboardSearch } from '@/components/dashboard/dashboard-search';
import { Button } from '@/components/ui/button';
import {
  DashboardBodyFallback,
  DashboardBodySection,
  DashboardHeroFallback,
  DashboardHeroSection,
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

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr] lg:gap-5">
          <div className="order-2 min-w-0 lg:order-1">
            <div className="bento-card p-4 sm:p-5">
              <DashboardSearch />
            </div>
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <Suspense fallback={<DashboardHeroFallback />}>
              <DashboardHeroSection />
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
