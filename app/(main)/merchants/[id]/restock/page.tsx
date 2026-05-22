import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { restockMerchant } from '../actions';
import { RestockForm } from './restock-form';
import { MerchantRestockLogistics } from '@/components/merchants/merchant-restock-logistics';
import {
  MerchantFormActions,
  MerchantNotice,
  MerchantSection,
  MerchantWorkspace,
} from '@/components/merchants/merchant-ui';
import { loadMerchantShippingDefaults } from '@/lib/merchant-operation-options';

export const dynamic = 'force-dynamic';

export default async function MerchantRestockPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      productRules: { include: { product: true }, orderBy: { suggestedPrice: 'desc' } },
      stocks: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  const allProducts = await prisma.product.findMany({
    where: { status: 'active' },
    include: {
      priceTiers: { orderBy: { price: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  const stockMap = new Map(merchant.stocks.map((s) => [s.productId, s.quantity]));
  const ruleProductIds = new Set(merchant.productRules.map((r) => r.productId));

  const sortedProducts = [...allProducts].sort((a, b) => {
    const aRule = ruleProductIds.has(a.id) ? 0 : 1;
    const bRule = ruleProductIds.has(b.id) ? 0 : 1;
    return aRule - bRule || a.name.localeCompare(b.name, 'zh-Hant');
  });

  const shippingDefaults = await loadMerchantShippingDefaults(merchant.id);

  const productOptions = sortedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    isConsigned: ruleProductIds.has(p.id),
    currentStock: stockMap.get(p.id) ?? 0,
    defaultUnit: p.unit,
    priceTiers: p.priceTiers.map((tier) => ({
      id: tier.id,
      weightGrams: tier.weightGrams,
      unit: tier.unit,
      unitQty: tier.unitQty,
      price: tier.price,
      notes: tier.notes,
    })),
  }));

  const submitStep = shippingDefaults ? 3 : 2;

  return (
    <>
      <PageHeader
        title={`進貨：${merchant.name}`}
        description="建立寄到店家的出貨單 — 多筆一起送，物流人員會接手處理"
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
        <form action={restockMerchant} className="space-y-4">
          <input type="hidden" name="merchantId" value={merchant.id} />

          <MerchantSection
            step={1}
            title="進貨商品"
            description="可一次加多筆；未設定分潤規則的商品會顯示提醒，請至「商品與庫存」補齊。"
          >
            <RestockForm products={productOptions} />
          </MerchantSection>

          {shippingDefaults ? (
            <MerchantSection
              step={2}
              title="物流與收件"
              description="預設帶入店家檔案，僅影響本張出貨單。"
            >
              <MerchantRestockLogistics
                merchantId={merchant.id}
                merchantLabel={`${merchant.name}（${merchant.merchantId}）`}
                defaults={shippingDefaults}
              />
            </MerchantSection>
          ) : null}

          <MerchantSection
            step={submitStep}
            title="備註與送出"
            description="送出後進入出貨隊列，送達後才會加到店家庫存。"
          >
            <div className="space-y-4">
              <label htmlFor="note" className="block text-xs font-medium text-muted-foreground">
                備註（選填）
              </label>
              <input
                id="note"
                name="note"
                type="text"
                placeholder="補貨、首批寄賣…"
                className="block w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <MerchantNotice variant="info">
                流程：待出貨 → 寄出 → 貨物到達。標記「貨物到達」後，庫存才會增加。
              </MerchantNotice>
              <MerchantFormActions>
                <Button variant="outline" asChild>
                  <Link href={`/merchants/${merchant.id}`}>取消</Link>
                </Button>
                <Button type="submit">建立出貨單</Button>
              </MerchantFormActions>
            </div>
          </MerchantSection>
        </form>
      </MerchantWorkspace>
    </>
  );
}
