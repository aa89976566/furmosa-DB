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
import { loadMerchantStockSnapshot, loadUnpostedMerchantRestocks } from '@/lib/merchant-operation-options';

export const dynamic = 'force-dynamic';

export default async function MerchantAdjustPage({
  params,
}: {
  params: { id: string };
}) {
  const [catalog, stockSnapshot, unpostedRestocks] = await Promise.all([
    loadActiveMerchantProductCatalog(params.id),
    loadMerchantStockSnapshot(params.id),
    loadUnpostedMerchantRestocks(params.id),
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
      priceTiers: product.priceTiers.map((tier) => ({
        id: tier.id,
        weightGrams: tier.weightGrams,
        unit: tier.unit,
        unitQty: tier.unitQty,
        price: tier.price,
        notes: tier.notes,
      })),
    };
  });

  return (
    <>
      <PageHeader
        title={`清點：${merchant.name}`}
        description="點庫存數字輸入現場剩餘數量；變少預設記售出，變多預設記補登進貨"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="清點庫存" description="就地展開輸入現場數量，完成後 5 秒內可撤銷">
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
            unpostedRestocks={unpostedRestocks}
            products={productOptions}
          />
        </SectionCard>
      </div>
    </>
  );
}
