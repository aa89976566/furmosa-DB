import { MerchantSelect } from '@/components/merchants/merchant-select';
import { MerchantSettlementSection } from '@/app/(main)/merchants/[id]/merchant-settlement-section';
import { createSettlement } from '@/app/(main)/settlements/actions';
import { loadMerchantSettlementPageData } from '@/lib/merchant-settlement-page';
export async function SettlementCreatePanel({
  merchants,
  selectedMerchantId,
  searchParams,
}: {
  merchants: { id: string; name: string; merchantId: string }[];
  selectedMerchantId: string;
  searchParams?: {
    settle_from?: string;
    settle_to?: string;
    settle_shipping?: string;
    settle_reward?: string;
  };
}) {
  if (merchants.length === 0) {
    return <p className="text-sm text-muted-foreground">尚無可選店家，請先新增寄賣店家。</p>;
  }

  const data = selectedMerchantId
    ? await loadMerchantSettlementPageData(selectedMerchantId, searchParams)
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="settlement-merchantId" className="text-sm font-medium">
          店家
        </label>
        <MerchantSelect merchants={merchants} value={selectedMerchantId} preserveView="create" />
        {data?.merchant && (
          <p className="text-xs text-muted-foreground">
            目前選擇：{data.merchant.name}（{data.merchant.merchantId}）
          </p>
        )}
      </div>

      {data ? (
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
          previewBasePath="/merchants/settlements"
          showPastSettlements={false}
        />
      ) : null}
    </div>
  );
}
