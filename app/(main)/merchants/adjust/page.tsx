import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { MerchantAdjustWorkspace } from '@/components/merchants/merchant-adjust-workspace';
import {
  listMerchantsForSelect,
  loadMerchantAdjustProductOptions,
  loadMerchantStockSnapshot,
  loadUnpostedMerchantRestocks,
  resolveSelectedMerchantId,
} from '@/lib/merchant-operation-options';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantsAdjustPage({
  searchParams,
}: {
  searchParams?: { merchantId?: string; mode?: string; productId?: string };
}) {
  const merchants = await listMerchantsForSelect();
  const selectedMerchantId = resolveSelectedMerchantId(merchants, searchParams?.merchantId);
  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId);
  const [productOptions, stockSnapshot, unpostedRestocks] = selectedMerchantId
    ? await Promise.all([
        loadMerchantAdjustProductOptions(selectedMerchantId),
        loadMerchantStockSnapshot(selectedMerchantId),
        loadUnpostedMerchantRestocks(selectedMerchantId),
      ])
    : [null, null, []];

  const merchantLabel = selectedMerchant
    ? `${selectedMerchant.name}（${selectedMerchant.merchantId}）`
    : undefined;

  return (
    <>
      <PageHeader
        title="清點"
        description="選擇店家，點庫存數字輸入現場剩餘數量；變少預設記售出，變多預設記補登進貨"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回寄賣
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="清點庫存" description="就地展開輸入現場數量，完成後 5 秒內可撤銷">
          {merchants.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無可選店家。</p>
          ) : (
            <MerchantAdjustWorkspace
              merchants={merchants}
              selectedMerchantId={selectedMerchantId}
              selectedMerchantLabel={merchantLabel}
              stockRows={stockSnapshot ?? []}
              unpostedRestocks={unpostedRestocks ?? []}
              products={productOptions ?? []}
            />
          )}
        </SectionCard>
      </div>
    </>
  );
}
