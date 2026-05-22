import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { MerchantsOperationsDashboard } from '@/components/merchants/merchants-operations-dashboard';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { MerchantsPeriodSwitch } from '@/components/merchants/merchants-period-switch';
import { Button } from '@/components/ui/button';
import {
  loadMerchantsPortfolioReport,
  resolveMerchantReportPeriod,
  type MerchantReportPeriod,
} from '@/lib/merchant-report';
import { PackagePlus, Plus, ScanLine } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const period: MerchantReportPeriod = searchParams?.period === 'week' ? 'week' : 'month';
  const { start: periodStart, end: periodEnd } = resolveMerchantReportPeriod(period);
  const report = await loadMerchantsPortfolioReport(periodStart, periodEnd);

  return (
    <>
      <PageHeader
        title="寄賣店家 Merchants"
        description="寄賣 / 快閃 / 旗艦 / 合作夥伴 通路管理"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MerchantsPeriodSwitch value={period} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/merchants/restock">
                <PackagePlus className="mr-1 h-4 w-4" />
                新增進貨
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/merchants/adjust?mode=count">
                <ScanLine className="mr-1 h-4 w-4" />
                清點
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/merchants/new">
                <Plus className="mr-1 h-4 w-4" />
                新增店家
              </Link>
            </Button>
          </div>
        }
      />
      <MerchantWorkspace>
        <MerchantsOperationsDashboard report={report} />
      </MerchantWorkspace>
    </>
  );
}
