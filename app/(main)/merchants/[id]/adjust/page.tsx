import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  loadActiveMerchantProductCatalog,
  merchantSuggestedUnitPrice,
} from '@/lib/merchant-product-catalog';
import { adjustMerchantStock, recordMerchantQuickSale } from '../actions';
import { AdjustForm } from './adjust-form';

export const dynamic = 'force-dynamic';

export default async function MerchantAdjustPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { productId?: string; mode?: string };
}) {
  const catalog = await loadActiveMerchantProductCatalog(params.id);
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
    };
  });

  return (
    <>
      <PageHeader
        title={`盤點 / 賣出登記：${merchant.name}`}
        description="一筆一筆對：實地盤點剩多少，或店家回報賣了多少都可以"
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
          description="兩種模式：盤點（覆寫成新數量）或 賣出（從庫存扣掉並算抽成）"
          className="lg:col-span-2"
        >
          {productOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">系統尚無可選商品，請先到產品主檔建立並啟用商品。</p>
          ) : (
            <AdjustForm
              merchantId={merchant.id}
              products={productOptions}
              initialProductId={searchParams?.productId}
              initialMode={searchParams?.mode === 'sold' ? 'sold' : 'count'}
              countAction={adjustMerchantStock}
              saleAction={recordMerchantQuickSale}
            />
          )}
        </SectionCard>

        <SectionCard title="提醒" description="兩種模式怎麼用" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <div className="font-semibold">盤點</div>
              <div className="text-xs text-muted-foreground">
                寫入「現場最終數量」。系統會記下差異 (例如 5 → 3 = -2)，常用於回收破損 / 漏記 / 失竊。
              </div>
            </li>
            <li className="rounded-md border-l-4 border-warning bg-warning/5 p-3">
              <div className="font-semibold">賣出</div>
              <div className="text-xs text-muted-foreground">
                店家對帳說「這個月賣了 N 個」就用這個。系統會：
                <br />
                • 扣店家庫存 -N
                <br />
                • 自動依抽成規則算店家抽成、公司實收
                <br />
                • 寫入流水（type=sale），但不開正式訂單
              </div>
            </li>
            <li className="rounded-md border-l-4 border-info bg-info/5 p-3">
              <div className="font-semibold">需要開正式訂單？</div>
              <div className="text-xs text-muted-foreground">
                想記錄客戶資料、要進結算的，請改走「建立訂單」。
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
