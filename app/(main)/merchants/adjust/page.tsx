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
        description="選擇店家，在庫存表點賣出輸入數量；需要時可用盤點校正現場數量"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回寄賣
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard
          title="登記異動"
          description="庫存表直接賣出或盤點"
          className="lg:col-span-2"
        >
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
              countReturnTo={`/merchants/adjust?merchantId=${selectedMerchantId}`}
            />
          )}
        </SectionCard>

        <SectionCard title="提醒" description="兩種模式怎麼用" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border-l-4 border-warning bg-warning/5 p-3">
              <div className="font-semibold">從庫存賣出（建議）</div>
              <div className="text-xs text-muted-foreground">
                在庫存表點「賣出」→ 輸入件數 → 看即時結算 → 送出。庫存會自動扣除並納入月結。
              </div>
            </li>
            <li className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <div className="font-semibold">盤點</div>
              <div className="text-xs text-muted-foreground">
                在庫存表點「盤點」→ 填現場剩餘數量。若比系統少，差額會當作賣出納入月結。
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
