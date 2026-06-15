'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { adjustMerchantStock } from '@/app/(main)/merchants/[id]/actions';
import { Button } from '@/components/ui/button';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { ScanLine, X } from 'lucide-react';

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  weightLabel?: string | null;
};

type CountFormState = { error?: string };

async function submitCount(
  _prev: CountFormState,
  formData: FormData,
): Promise<CountFormState> {
  try {
    await adjustMerchantStock(formData);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      error: error instanceof Error ? error.message : '盤點失敗，請稍後再試',
    };
  }
  return {};
}

function SubmitCountButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="ml-auto" disabled={pending}>
      <ScanLine className="mr-1 h-3.5 w-3.5" />
      {pending ? '處理中…' : '確認盤點'}
    </Button>
  );
}

export function MerchantStockInlineCount({
  merchantId,
  product,
  returnTo,
  onCancel,
}: {
  merchantId: string;
  product: ProductOption;
  returnTo?: string;
  onCancel: () => void;
}) {
  const [newQuantity, setNewQuantity] = useState(product.currentStock);
  const [state, formAction] = useFormState(submitCount, {});
  const countDiff = Number.isFinite(newQuantity) ? newQuantity - product.currentStock : null;

  return (
    <form action={formAction} className="space-y-3 rounded-md border bg-muted/20 p-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      <input type="hidden" name="productId" value={product.id} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{product.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {product.sku}
            {product.weightLabel ? ` · ${product.weightLabel}` : ''}
            {' · '}系統現存 {product.currentStock}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" />
          取消
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={`count-${product.id}`} className="text-xs font-medium">
            實際盤點數量
          </label>
          <input
            id={`count-${product.id}`}
            name="newQuantity"
            type="number"
            min={0}
            step={1}
            required
            autoFocus
            value={newQuantity}
            onChange={(e) => setNewQuantity(Number(e.target.value))}
            className="block w-28 rounded-md border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <SubmitCountButton />
      </div>

      <p className="text-xs text-muted-foreground">
        填現場數到的最終數量。若比系統少，差額會自動記為賣出並納入月結。
      </p>

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      {countDiff != null && countDiff !== 0 && (
        <div
          className={`rounded-md border-l-4 p-2 text-xs ${
            countDiff > 0
              ? 'border-success bg-success/5 text-success'
              : 'border-destructive bg-destructive/5 text-destructive'
          }`}
        >
          差異：{countDiff > 0 ? '+' : ''}
          {countDiff} 件（系統 {product.currentStock} → 實際 {newQuantity}）
        </div>
      )}
    </form>
  );
}
