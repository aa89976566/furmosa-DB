'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { recordMerchantQuickSale } from '@/app/(main)/merchants/[id]/actions';
import { MerchantProductTierSelect } from '@/components/merchants/merchant-product-tier-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calcQuickSalePreview } from '@/lib/merchant-quick-sale-preview';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  hasMultipleTierOptions,
  pickDefaultTier,
  unitPriceForTierSale,
  type MerchantProductTierOption,
} from '@/lib/merchant-product-tier';
import { ShoppingBag, X } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
  priceTiers?: MerchantProductTierOption[];
};

type SaleFormState = { error?: string };

async function submitQuickSale(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  try {
    await recordMerchantQuickSale(formData);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      error: error instanceof Error ? error.message : '登記失敗，請稍後再試',
    };
  }
  return {};
}

function SubmitSaleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="ml-auto" disabled={pending}>
      <ShoppingBag className="mr-1 h-3.5 w-3.5" />
      {pending ? '處理中…' : '登記銷售'}
    </Button>
  );
}

export function MerchantStockInlineSale({
  merchantId,
  product,
  initialTierId,
  tierLabel,
  onCancel,
}: {
  merchantId: string;
  product: ProductOption;
  initialTierId?: string;
  tierLabel?: string | null;
  onCancel: () => void;
}) {
  const tiers = product.priceTiers ?? [];
  const lockTier = initialTierId !== undefined;
  const [tierId, setTierId] = useState(
    () => initialTierId ?? pickDefaultTier(tiers)?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [state, formAction] = useFormState(submitQuickSale, {});
  const unitPrice = useMemo(
    () =>
      unitPriceForTierSale(tiers, tierId, {
        suggestedPrice: product.suggestedPrice,
        hasMerchantRule: product.commissionMode != null,
      }),
    [product.commissionMode, product.suggestedPrice, tierId, tiers],
  );
  const preview = calcQuickSalePreview(product, quantity, unitPrice);

  return (
    <form action={formAction} className="space-y-3 rounded-md border bg-muted/20 p-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      <input type="hidden" name="productId" value={product.id} />
      {lockTier ? <input type="hidden" name="tierId" value={tierId} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{product.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {product.sku}
            {tierLabel ? (
              <>
                {' · '}
                <span className="font-semibold text-navy">{tierLabel}</span>
              </>
            ) : null}
            {' · '}可賣 {product.currentStock}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" />
          取消
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {lockTier && tierLabel ? (
          <div className="space-y-1">
            <span className="text-xs font-medium">規格</span>
            <div>
              <Badge variant="secondary">{tierLabel}</Badge>
            </div>
          </div>
        ) : hasMultipleTierOptions(tiers) ? (
          <MerchantProductTierSelect
            tiers={tiers}
            tierId={tierId}
            onTierIdChange={setTierId}
            idPrefix={`sale-${product.id}`}
          />
        ) : null}
        <div className="space-y-1">
          <label htmlFor={`qty-${product.id}`} className="text-xs font-medium">
            賣出數量
          </label>
          <input
            id={`qty-${product.id}`}
            name="quantity"
            type="number"
            min={1}
            max={product.currentStock}
            step={1}
            required
            autoFocus
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="block w-28 rounded-md border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {product.currentStock > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuantity(product.currentStock)}
          >
            全部（{product.currentStock}）
          </Button>
        )}
        <SubmitSaleButton />
      </div>

      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      {!product.commissionMode && (
        <p className="text-xs text-warning">尚未設定分潤規則，店家抽成以 0 計算。</p>
      )}

      {preview && (
        <div className="grid grid-cols-3 gap-2 rounded-md border bg-background p-2 text-sm">
          <div>
            <div className="text-[10px] text-muted-foreground">銷售總額</div>
            <div className="font-semibold tabular-nums">{fmt(preview.gross)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">店家抽成</div>
            <div className="font-semibold tabular-nums text-warning">{fmt(preview.commission)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">公司實收</div>
            <div className="font-semibold tabular-nums text-success">{fmt(preview.revenue)}</div>
          </div>
          <div className="col-span-3 border-t pt-1.5 text-xs text-muted-foreground">
            扣完後庫存：{product.currentStock} → {preview.afterStock}
            {preview.afterStock < 0 && (
              <span className="ml-2 text-destructive">將變成負庫存</span>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
