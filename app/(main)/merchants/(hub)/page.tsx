import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { MerchantsOperationsDashboard } from '@/components/merchants/merchants-operations-dashboard';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { MerchantsPeriodSwitch } from '@/components/merchants/merchants-period-switch';
import { Button } from '@/components/ui/button';
import {
  loadMerchantsPortfolioReport,
  resolveMerchantReportPeriod,
  type MerchantReportPeriod,
} from '@/lib/merchant-report';
import { merchantSearchWhere } from '@/lib/site-search';
import { PackagePlus, Plus, Receipt, ScanLine } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantsOverviewPage({
  searchParams,
}: {
  searchParams?: { period?: string; q?: string };
}) {
  // 豬窩／柒沐 ensure 改由 cron；讀頁直接載報表
  const period: MerchantReportPeriod = searchParams?.period === 'week' ? 'week' : 'month';
  const q = (searchParams?.q ?? '').trim();
  const { start: periodStart, end: periodEnd } = resolveMerchantReportPeriod(period);

  let merchantIds: string[] | undefined;
  if (q) {
    const matches = await prisma.merchant.findMany({
      where: merchantSearchWhere(q),
      select: { id: true },
    });
    merchantIds = matches.map((m) => m.id);
  }

  const report =
    q && merchantIds && merchantIds.length === 0
      ? {
          periodStart,
          periodEnd,
          merchants: [],
          topProducts: [],
          totals: {
            soldQty: 0,
            grossSales: 0,
            commissionAmount: 0,
            companyRevenue: 0,
            totalStock: 0,
            restockQty: 0,
            merchantCount: 0,
            lowStockSkus: 0,
            outOfStockSkus: 0,
            inTransitShipments: 0,
            openSettlements: 0,
          },
        }
      : await loadMerchantsPortfolioReport(periodStart, periodEnd, {
          merchantIds,
        });

  return (
    <MerchantWorkspace>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MerchantsPeriodSwitch value={period} />
        <Button variant="outline" size="sm" asChild>
          <Link href="/merchants/settlements?view=create">
            <Receipt className="mr-1 h-4 w-4" />
            建立月結
          </Link>
        </Button>
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
      <MerchantsOperationsDashboard report={report} />
    </MerchantWorkspace>
  );
}
