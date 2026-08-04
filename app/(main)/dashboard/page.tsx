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

      {/*
        待辦移除後不再用左右雙欄（左空右重）。
        專業層級：工具列 → 主數字橫排 → 細節（數字優先、無空洞）。
      */}
      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        <div className="bento-card p-3 sm:p-4">
          <DashboardSearch />
        </div>

        <Suspense fallback={<DashboardHeroFallback />}>
          <DashboardHeroSection />
        </Suspense>

        <Suspense fallback={<DashboardBodyFallback />}>
          <DashboardBodySection />
        </Suspense>
      </div>
    </>
  );
}
