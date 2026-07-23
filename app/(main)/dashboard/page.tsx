import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionBlock } from '@/components/shared/section-block';
import { DashboardSearch } from '@/components/dashboard/dashboard-search';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
        title="Furmosa Dashboard"
        description="即時掌握全品牌營運狀況：訂單、營收、庫存、寄賣表現、會員與待辦"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href="/orders/new">
                <Plus className="mr-1 h-4 w-4" />
                快速建立訂單
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/orders">訂單列表</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 p-6">
        <SectionBlock
          tone="orders"
          title="搜尋與今日任務"
          description="快速找到訂單、會員、商品；勾選紀錄今日待辦"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="relative z-0 min-w-0">
              <DashboardSearch />
            </div>
            <div className="relative z-10 min-w-0">
              <Suspense fallback={<DashboardTasksFallback />}>
                <DashboardTasksSection />
              </Suspense>
            </div>
          </div>
        </SectionBlock>

        <Suspense fallback={<DashboardBodyFallback />}>
          <DashboardBodySection />
        </Suspense>
      </div>
    </>
  );
}
