import { notFound } from 'next/navigation';
import { createSettlement } from '@/app/(main)/settlements/actions';
import { MerchantSettlementSection } from '../merchant-settlement-section';
import { loadMerchantSettlementPageData } from '@/lib/merchant-settlement-page';

export const dynamic = 'force-dynamic';

export default async function MerchantSettlementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    settle_from?: string;
    settle_to?: string;
    settle_shipping?: string;
    settle_reward?: string;
  };
}) {
  const data = await loadMerchantSettlementPageData(params.id, searchParams);
  if (!data) notFound();

  return (
    <div className="space-y-6 p-6">
      <MerchantSettlementSection
        merchantId={data.merchant.id}
        defaultFrom={data.defaultFrom}
        defaultTo={data.defaultTo}
        currentFrom={data.currentFrom}
        currentTo={data.currentTo}
        shippingFee={data.shippingFee}
        rewardPayout={data.rewardPayout}
        preview={data.preview}
        pastSettlements={data.pastSettlements}
        createSettlementAction={createSettlement}
        hasPreviewQuery={data.hasPreviewQuery}
      />
    </div>
  );
}
