'use client';

import { MerchantStockQuickEdit } from '@/components/merchants/merchant-stock-quick-edit';
import { Badge } from '@/components/ui/badge';
import type { MerchantProductTierStock } from '@/lib/merchant-product-tier-stocks';

export type { MerchantProductTierStock };

export function MerchantProductsStockCell({
  merchantId,
  productId,
  productName,
  totalQuantity,
  tierStocks,
  multiWeightTiers,
  returnTo,
  align = 'end',
}: {
  merchantId: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  tierStocks: MerchantProductTierStock[];
  multiWeightTiers: boolean;
  returnTo: string;
  align?: 'start' | 'end';
}) {
  const alignClass = align === 'start' ? 'items-start' : 'items-end';

  if (!multiWeightTiers) {
    const tier = tierStocks[0];
    return (
      <div className={`flex flex-col ${alignClass}`}>
        <MerchantStockQuickEdit
          merchantId={merchantId}
          productId={productId}
          productName={productName}
          quantity={tier?.quantity ?? totalQuantity}
          tierId={tier?.tierId}
          tierLabel={tier?.label}
          returnTo={returnTo}
          align={align}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${alignClass}`}>
      <div className="text-sm text-muted-foreground">
        合計 <span className="font-mono font-semibold text-foreground">{totalQuantity}</span>
      </div>
      {tierStocks.map((tier) => (
        <div
          key={tier.tierId}
          className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
        >
          <Badge variant="outline" className="text-xs font-medium">
            {tier.label}
          </Badge>
          <MerchantStockQuickEdit
            merchantId={merchantId}
            productId={productId}
            productName={productName}
            quantity={tier.quantity}
            tierId={tier.tierId}
            tierLabel={tier.label}
            returnTo={returnTo}
            align={align}
          />
        </div>
      ))}
    </div>
  );
}
