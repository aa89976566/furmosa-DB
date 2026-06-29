import { PageHeader } from '@/components/shared/page-header';
import {
  StoreRedemptionDetailTable,
  StoreRedemptionFilterPanel,
  StoreRedemptionKpiStrip,
  StoreRedemptionLinkPanel,
  StoreRedemptionSummaryTable,
} from '@/components/admin/store-redemption-report-ui';
import { GROOMING_COUPON_DISCOUNT_LABEL } from '@/lib/coupons/constants';
import {
  expireCoupons,
  getStoreRedemptionReport,
  listStoreRedemptionDetails,
} from '@/lib/coupons/service';
import { parseStoreRedemptionReportParams } from '@/lib/store-redemption-report-query';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';

export const dynamic = 'force-dynamic';

export default async function StoreReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await expireCoupons();

  const stores = await listPartnerStoresFromDb();
  const params = parseStoreRedemptionReportParams(searchParams, stores);

  const [rows, details] = await Promise.all([
    getStoreRedemptionReport(params.filter),
    listStoreRedemptionDetails(params.filter),
  ]);

  const totalCount = rows.reduce((sum, row) => sum + row.redeemedCount, 0);
  const totalPayable = rows.reduce((sum, row) => sum + row.totalPayable, 0);
  const showStoreSummary = !params.storeSlug;

  return (
    <>
      <PageHeader
        tone="supply"
        title="店家核銷報表"
        description={`美容院折價券（${GROOMING_COUPON_DISCOUNT_LABEL}）· 依店家與期間統計核銷張數，計算應付店家結帳金額`}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <StoreRedemptionFilterPanel
          from={params.from}
          to={params.to}
          storeSlug={params.storeSlug}
          storeLabel={params.storeLabel}
          stores={stores}
        />

        <StoreRedemptionKpiStrip
          totalCount={totalCount}
          totalPayable={totalPayable}
          storeCount={rows.length}
          storeLabel={params.storeLabel}
        />

        <StoreRedemptionSummaryTable rows={rows} showStoreColumn={showStoreSummary} />

        <StoreRedemptionDetailTable details={details} storeLabel={params.storeLabel} />

        <StoreRedemptionLinkPanel storeSlug={params.storeSlug} />
      </div>
    </>
  );
}
