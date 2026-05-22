import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import {
  MerchantField,
  MerchantFormActions,
  MerchantSection,
  MerchantWorkspace,
} from '@/components/merchants/merchant-ui';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  loadActiveMerchantProductCatalog,
  merchantCommissionPerUnit,
  merchantSuggestedUnitPrice,
} from '@/lib/merchant-product-catalog';
import { createMerchantSale } from '../actions';
import { SaleForm } from './sale-form';

export const dynamic = 'force-dynamic';

export default async function MerchantSalePage({ params }: { params: { id: string } }) {
  const catalog = await loadActiveMerchantProductCatalog(params.id);
  if (!catalog) notFound();

  const { merchant, products, ruleByProduct, stockByProduct, consignedProductIds } = catalog;

  const items = products.map((product) => {
    const rule = ruleByProduct.get(product.id);
    const suggestedPrice = merchantSuggestedUnitPrice(product, rule);
    const commissionPerUnit = merchantCommissionPerUnit(rule, suggestedPrice);

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: stockByProduct.get(product.id) ?? 0,
      isConsigned: consignedProductIds.has(product.id),
      defaultUnit: product.unit,
      priceTiers: product.priceTiers.map((tier) => ({
        id: tier.id,
        weightGrams: tier.weightGrams,
        unit: tier.unit,
        unitQty: tier.unitQty,
        price: tier.price,
        notes: tier.notes,
      })),
      suggestedPrice,
      commissionMode: rule?.commissionMode ?? null,
      commissionValue: rule?.commissionValue ?? null,
      commissionPerUnit,
      companyRevenuePerUnit: suggestedPrice - commissionPerUnit,
    };
  });

  return (
    <>
      <PageHeader
        title={`建立寄賣訂單：${merchant.name}`}
        description="選商品 → 自動帶入該店家的售價與抽成 → 送出後扣店家庫存"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />
      <MerchantWorkspace narrow>
        {items.length === 0 ? (
          <MerchantSection title="新增訂單" description="尚無可選商品">
            <p className="text-sm text-muted-foreground">請先到產品主檔建立並啟用商品。</p>
          </MerchantSection>
        ) : (
          <form action={createMerchantSale} className="space-y-4">
            <input type="hidden" name="merchantId" value={merchant.id} />
            <MerchantSection
              step={1}
              title="訂單品項"
              description="自動帶入該店售價與抽成；未設定規則時抽成為 0。"
            >
              <SaleForm items={items} />
            </MerchantSection>
            <MerchantSection step={2} title="備註與送出">
              <div className="space-y-4">
                <MerchantField label="備註（選填）">
                  <input
                    id="note"
                    name="note"
                    type="text"
                    placeholder="月結 / 客戶名稱 / 訂單編號…"
                    className="block w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </MerchantField>
                <MerchantFormActions>
                  <Button variant="outline" asChild>
                    <Link href={`/merchants/${merchant.id}`}>取消</Link>
                  </Button>
                  <Button type="submit">送出訂單</Button>
                </MerchantFormActions>
              </div>
            </MerchantSection>
          </form>
        )}
      </MerchantWorkspace>
    </>
  );
}