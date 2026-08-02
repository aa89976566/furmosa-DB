import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionBlock } from '@/components/shared/section-block';
import { DashboardSearch } from '@/components/dashboard/dashboard-search';
import { Button } from '@/components/ui/button';
import { Package, Truck } from 'lucide-react';
import {
  DashboardBodyFallback,
  DashboardBodySection,
  DashboardOpsFallback,
  DashboardOpsSection,
  DashboardTasksFallback,
  DashboardTasksSection,
} from './dashboard-stream';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        tone="overview"
        title="今天營運"
        description="先處理店家叫貨、出貨與異常；KPI 與報表往下捲。對齊 POS／LINE 今日任務流。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href="/restock-requests">
                <Package className="mr-1 h-4 w-4" />
                審叫貨
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments?status=pending">
                <Truck className="mr-1 h-4 w-4" />
                出貨隊列
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 p-6">
        <SectionBlock
          tone="overview"
          title="今天要做的事"
          description="固定順序：待審叫貨 → 待寄 → 預約／換罐異常。每個數字都可點進去。"
        >
          <Suspense fallback={<DashboardOpsFallback />}>
            <DashboardOpsSection />
          </Suspense>
        </SectionBlock>

        <SectionBlock
          tone="orders"
          title="搜尋與個人待辦"
          description="快速找訂單、會員、商品；下方勾選僅供個人備忘，不是營運佇列"
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
