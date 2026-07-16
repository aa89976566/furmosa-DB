'use client';

import { Badge } from '@/components/ui/badge';
import { MerchantStockInlineMovement } from '@/components/merchants/merchant-stock-inline-movement';
import type { MerchantProductTierStock } from '@/lib/merchant-product-tier-stocks';

export type { MerchantProductTierStock };

export function MerchantProductsStockCell({
  merchantId,
  productId,
  productName,
  totalQuantity,
  tierStocks,
  unitPrice,
  commissionPercent,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  tierStocks: MerchantProductTierStock[];
  returnTo?: string;
  unitPrice?: number | null;
  commissionPercent?: number | null;
}) {
  const rows =
    tierStocks.length > 0
      ? tierStocks
      : [{ tierId: '', label: '預設', quantity: totalQuantity }];

  return (
    <div className="flex flex-col items-end gap-2">
      {rows.length > 1 ? (
        <div className="text-sm text-muted-foreground">
          合計 <span className="font-mono font-semibold text-foreground">{totalQuantity}</span>
        </div>
      ) : null}
      {rows.map((tier) => (
        <div
          key={tier.tierId || 'legacy'}
          className="flex w-full flex-wrap items-start justify-end gap-2"
        >
          {rows.length > 1 ? (
            <Badge variant="outline" className="mt-1 text-xs font-medium">
              {tier.label}
            </Badge>
          ) : null}
          <MerchantStockInlineMovement
            merchantId={merchantId}
            productId={productId}
            productName={productName}
            tierId={tier.tierId}
            tierLabel={rows.length > 1 ? tier.label : null}
            quantity={tier.quantity}
            unitPrice={unitPrice ?? null}
            commissionPercent={commissionPercent ?? null}
          />
        </div>
      ))}
    </div>
  );
}
