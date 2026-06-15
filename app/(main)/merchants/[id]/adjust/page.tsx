import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { MerchantAdjustWorkspace } from '@/components/merchants/merchant-adjust-workspace';
import {
  loadActiveMerchantProductCatalog,
  merchantSuggestedUnitPrice,
} from '@/lib/merchant-product-catalog';
import { resolveProductWeightLabel } from '@/lib/product-label';
import { loadMerchantStockSnapshot } from '@/lib/merchant-operation-options';

export const dynamic = 'force-dynamic';

export default async function MerchantAdjustPage({
  params,
}: {
  params: { id: string };
}) {
  const [catalog, stockSnapshot] = await Promise.all([
    loadActiveMerchantProductCatalog(params.id),
    loadMerchantStockSnapshot(params.id),
  ]);
  if (!catalog) notFound();

  const { merchant, products, ruleByProduct, stockByProduct, consignedProductIds } = catalog;

  const productOptions = products.map((product) => {
    const rule = ruleByProduct.get(product.id);
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      isConsigned: consignedProductIds.has(product.id),
      currentStock: stockByProduct.get(product.id) ?? 0,
      suggestedPrice: merchantSuggestedUnitPrice(product, rule),
      commissionMode: rule?.commissionMode ?? null,
      commissionValue: rule?.commissionValue ?? null,
      weightLabel: resolveProductWeightLabel(product.name, product.priceTiers),
    };
  });

  return (
    <>
      <PageHeader
        title={`盤點 / 賣出：${merchant.name}`}
        description="在庫存表點賣出輸入數量，即時結算並更新庫存"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
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
          <MerchantAdjustWorkspace
            merchants={[
              {
                id: merchant.id,
                name: merchant.name,
                merchantId: merchant.merchantId,
              },
            ]}
            selectedMerchantId={merchant.id}
            selectedMerchantLabel={`${merchant.name}（${merchant.merchantId}）`}
            stockRows={stockSnapshot ?? []}
            products={productOptions}
            countReturnTo={`/merchants/${merchant.id}/adjust`}
          />
        </SectionCard>

        <SectionCard title="提醒" description="兩種模式怎麼用" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border-l-4 border-warning bg-warning/5 p-3">
              <div className="font-semibold">從庫存賣出（建議）</div>
              <div className="text-xs text-muted-foreground">
                庫存表點「賣出」→ 輸入件數 → 即時看結算 → 送出扣庫存。
              </div>
            </li>
            <li className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <div className="font-semibold">盤點</div>
              <div className="text-xs text-muted-foreground">
                在庫存表點「盤點」填現場剩餘數量；若比系統少，差額納入月結。
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
