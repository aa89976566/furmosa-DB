import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { MerchantSelect } from '@/components/merchants/merchant-select';
import {
  listMerchantsForSelect,
  loadMerchantAdjustProductOptions,
  resolveSelectedMerchantId,
} from '@/lib/merchant-operation-options';
import { adjustMerchantStock, recordMerchantQuickSale } from '../[id]/actions';
import { AdjustForm } from '../[id]/adjust/adjust-form';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantsAdjustPage({
  searchParams,
}: {
  searchParams?: { merchantId?: string; mode?: string };
}) {
  const merchants = await listMerchantsForSelect();
  const selectedMerchantId = resolveSelectedMerchantId(merchants, searchParams?.merchantId);
  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId);
  const productOptions = selectedMerchantId
    ? await loadMerchantAdjustProductOptions(selectedMerchantId)
    : null;

  return (
    <>
      <PageHeader
        title="清點"
        description="選擇店家後登記現場盤點或快速賣出"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回寄賣店家
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard
          title="登記異動"
          description="盤點覆寫現場數量，或登記店家回報賣出"
          className="lg:col-span-2"
        >
          {merchants.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無可選店家。</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="merchantId" className="text-sm font-medium">
                  店家
                </label>
                <MerchantSelect merchants={merchants} value={selectedMerchantId} />
              </div>
              {selectedMerchant && (
                <p className="text-xs text-muted-foreground">
                  目前選擇：{selectedMerchant.name}（{selectedMerchant.merchantId}）
                </p>
              )}
              {productOptions && productOptions.length > 0 ? (
                <AdjustForm
                  key={selectedMerchantId}
                  merchantId={selectedMerchantId}
                  products={productOptions}
                  initialMode={searchParams?.mode === 'sold' ? 'sold' : 'count'}
                  countAction={adjustMerchantStock}
                  saleAction={recordMerchantQuickSale}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  系統尚無可選商品，請先到產品主檔建立並啟用商品。
                </p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="提醒" description="兩種模式怎麼用" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <div className="font-semibold">盤點</div>
              <div className="text-xs text-muted-foreground">
                寫入現場最終數量。系統會記下差異，常用於回收破損、漏記或失竊。
              </div>
            </li>
            <li className="rounded-md border-l-4 border-warning bg-warning/5 p-3">
              <div className="font-semibold">賣出</div>
              <div className="text-xs text-muted-foreground">
                店家回報賣了多少時使用。系統會扣庫存、依規則算抽成，並寫入 sale 流水。
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
