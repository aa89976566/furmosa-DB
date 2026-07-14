'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MerchantStockMovementDialog } from '@/components/merchants/merchant-stock-movement-dialog';
import type { MerchantProductTierStock } from '@/lib/merchant-product-tier-stocks';

export type { MerchantProductTierStock };

export function MerchantProductsStockCell({
  merchantId,
  productId,
  productName,
  totalQuantity,
  tierStocks,
  returnTo,
  unitPrice,
  commissionPercent,
  align = 'end',
}: {
  merchantId: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  tierStocks: MerchantProductTierStock[];
  returnTo: string;
  unitPrice?: number | null;
  commissionPercent?: number | null;
  align?: 'start' | 'end';
}) {
  const alignClass = align === 'start' ? 'items-end' : 'items-end';
  const rows =
    tierStocks.length > 0
      ? tierStocks
      : [{ tierId: '', label: '預設', quantity: totalQuantity }];

  const [active, setActive] = useState<{
    tierId: string;
    label: string;
    quantity: number;
  } | null>(null);

  return (
    <div className={`flex flex-col gap-2 ${alignClass}`}>
      {rows.length > 1 ? (
        <div className="text-sm text-muted-foreground">
          合計 <span className="font-mono font-semibold text-foreground">{totalQuantity}</span>
        </div>
      ) : null}
      {rows.map((tier) => {
        const qtyClass =
          tier.quantity === 0
            ? 'font-mono text-lg font-semibold text-destructive'
            : tier.quantity <= 3
              ? 'font-mono text-lg font-semibold text-warning'
              : 'font-mono text-lg font-semibold';
        return (
          <div
            key={tier.tierId || 'legacy'}
            className="flex flex-wrap items-center justify-end gap-2"
          >
            {rows.length > 1 ? (
              <Badge variant="outline" className="text-xs font-medium">
                {tier.label}
              </Badge>
            ) : null}
            <span className={qtyClass}>{tier.quantity}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                setActive({
                  tierId: tier.tierId,
                  label: tier.label,
                  quantity: tier.quantity,
                })
              }
            >
              登記異動
            </Button>
          </div>
        );
      })}

      {active ? (
        <MerchantStockMovementDialog
          open
          onClose={() => setActive(null)}
          merchantId={merchantId}
          productId={productId}
          productName={productName}
          tierId={active.tierId}
          tierLabel={rows.length > 1 ? active.label : null}
          quantity={active.quantity}
          unitPrice={unitPrice ?? null}
          commissionPercent={commissionPercent ?? null}
          returnTo={returnTo}
        />
      ) : null}
    </div>
  );
}
