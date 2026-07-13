'use client';

import { MerchantStockQuickEdit } from '@/components/merchants/merchant-stock-quick-edit';
import { Badge } from '@/components/ui/badge';

export type MerchantProductTierStock = {
  tierId: string;
  label: string;
  quantity: number;
};

export function MerchantProductsStockCell({
  merchantId,
  productId,
  productName,
  totalQuantity,
  tierStocks,
  multiWeightTiers,
  returnTo,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  tierStocks: MerchantProductTierStock[];
  multiWeightTiers: boolean;
  returnTo: string;
}) {
  if (!multiWeightTiers) {
    const tier = tierStocks[0];
    return (
      <MerchantStockQuickEdit
        merchantId={merchantId}
        productId={productId}
        productName={productName}
        quantity={tier?.quantity ?? totalQuantity}
        tierId={tier?.tierId}
        tierLabel={tier?.label}
        returnTo={returnTo}
      />
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="text-[10px] text-muted-foreground">
        合計 <span className="font-mono font-semibold text-foreground">{totalQuantity}</span>
      </div>
      {tierStocks.map((tier) => (
        <div
          key={tier.tierId}
          className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
        >
          <Badge variant="outline" className="text-[10px] font-medium">
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
          />
        </div>
      ))}
    </div>
  );
}
