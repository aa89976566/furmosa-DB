import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { variationLabel } from '@/lib/product-variations';
import { getMerchantTypes } from '@/lib/merchant-types-persist';
import { loadMerchantWholesalePrices } from '@/lib/merchant-wholesale-prices';
import { BASE_VARIANT_KEY } from '@/lib/orders/merchant-wholesale-price';
import { saveMerchantWholesalePrices } from '../actions';

export const dynamic = 'force-dynamic';

export default async function MerchantWholesalePricesPage({
  params,
}: {
  params: { id: string };
}) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, type: true },
  });
  if (!merchant) notFound();

  const types = await getMerchantTypes(prisma, merchant.id, merchant.type);
  const [products, prices] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'active', productCategory: 'STANDARD' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        unit: true,
        priceTiers: {
          orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
          select: {
            id: true,
            weightGrams: true,
            unit: true,
            unitQty: true,
            price: true,
            notes: true,
          },
        },
      },
    }),
    loadMerchantWholesalePrices(merchant.id),
  ]);

  if (!types.includes('wholesale')) {
    return (
      <div className="p-6">
        <SectionCard title="店家進貨價">
          <p className="text-sm text-muted-foreground">
            這家店尚未登記「販售」合作。請先回到店家總覽編輯合作方式。
          </p>
        </SectionCard>
      </div>
    );
  }

  const priceMap = new Map(
    prices.map((price) => [`${price.productId}:${price.variantKey}`, price.unitPrice]),
  );

  return (
    <div className="space-y-6 p-6">
      <SectionCard
        title="店家進貨價"
        description="填好後，新增販售訂單會自動帶入；留白代表這家店不能訂購該規格。"
      >
        <div className="divide-y rounded-lg border">
          {products.map((product) => {
            const variants =
              product.priceTiers.length > 0
                ? product.priceTiers.map((tier) => ({
                    key: tier.id,
                    label: variationLabel(tier),
                    retailPrice: tier.price,
                  }))
                : [{ key: BASE_VARIANT_KEY, label: product.unit, retailPrice: product.price }];
            return (
              <form
                key={product.id}
                action={saveMerchantWholesalePrices}
                className="space-y-3 p-4"
              >
                <input type="hidden" name="merchantId" value={merchant.id} />
                <input type="hidden" name="productId" value={product.id} />
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{product.sku}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {variants.map((variant) => (
                    <label key={variant.key} className="space-y-1 text-sm">
                      <input type="hidden" name="variantKey" value={variant.key} />
                      <span className="flex justify-between gap-2">
                        <span>{variant.label}</span>
                        <span className="text-xs text-muted-foreground">
                          建議售價 {formatCurrency(variant.retailPrice)}
                        </span>
                      </span>
                      <input
                        name="unitPrice"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={priceMap.get(`${product.id}:${variant.key}`) ?? ''}
                        placeholder="輸入進貨價"
                        className="block h-10 w-full rounded-md border bg-background px-3 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="outline">
                    儲存這項商品
                  </Button>
                </div>
              </form>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
