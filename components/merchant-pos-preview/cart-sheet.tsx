'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ACTUAL_PRICE_HINT,
  ACTUAL_PRICE_LABEL,
  ACTUAL_SUBTOTAL_LABEL,
  CART_TITLE,
  COMPLETE_SALE,
  COMPLETE_SALE_CANCEL,
  COMPLETE_SALE_CONFIRM,
  COMPLETE_SALE_CONFIRM_BODY,
  COMPLETE_SALE_CONFIRM_TITLE,
  DECREASE_QTY,
  INCREASE_QTY,
  ITEM_COUNT_LABEL,
  LIST_PRICE_LABEL,
  LIST_SUBTOTAL_LABEL,
  REMOVE_LINE,
} from '@/lib/merchant-pos-preview/copy';
import { allowanceLabel, formatQty, formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { cartLineTotals, cartTotals, findProductBySku } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { PreviewDialog } from './preview-dialog';

export function CartSheet({
  session,
  onClose,
  onQty,
  onRemove,
  onPrice,
  onAskComplete,
  onCancelComplete,
  onComplete,
}: {
  session: MerchantPosSession;
  onClose: () => void;
  onQty: (skuId: string, delta: number) => void;
  onRemove: (skuId: string) => void;
  onPrice: (skuId: string, value: string) => void;
  onAskComplete: () => void;
  onCancelComplete: () => void;
  onComplete: () => void;
}) {
  const totals = cartTotals(session.cart);

  return (
    <>
      <PreviewDialog open={session.cartOpen} titleId="cart-title" title={CART_TITLE} onClose={onClose}>
        <div className="space-y-4">
          <ul className="space-y-3">
            {session.cart.map((line) => {
              const product = findProductBySku(line.skuId);
              const result = cartLineTotals(line);
              const priceId = `actual-price-${line.skuId}`;
              const errorId = `${priceId}-error`;
              return (
                <li key={line.skuId} className="rounded-xl border border-border/70 p-3">
                  <p className="font-medium text-navy">{product?.name}</p>
                  <p className="text-sm text-muted-foreground">{result.variant?.specLabel}</p>
                  <p className="mt-1 text-sm">
                    {LIST_PRICE_LABEL} {result.variant ? formatTwd(result.variant.listPriceTwd) : '—'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] min-w-[44px]"
                      aria-label={DECREASE_QTY}
                      onClick={() => onQty(line.skuId, -1)}
                    >
                      −
                    </Button>
                    <span className="min-w-[3rem] text-center text-sm font-medium">{line.qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] min-w-[44px]"
                      aria-label={INCREASE_QTY}
                      onClick={() => onQty(line.skuId, 1)}
                    >
                      ＋
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => onRemove(line.skuId)}
                    >
                      {REMOVE_LINE}
                    </Button>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <label htmlFor={priceId} className="text-sm font-medium">
                      {ACTUAL_PRICE_LABEL}
                    </label>
                    <Input
                      id={priceId}
                      inputMode="numeric"
                      value={line.actualUnitPriceInput}
                      aria-invalid={Boolean(result.priceError)}
                      aria-describedby={result.priceError ? errorId : undefined}
                      className="min-h-[44px]"
                      onChange={(event) => onPrice(line.skuId, event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{ACTUAL_PRICE_HINT}</p>
                    {result.priceError ? (
                      <p id={errorId} role="alert" className="text-sm text-destructive">
                        {result.priceError}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt>{LIST_SUBTOTAL_LABEL}</dt>
              <dd>{formatTwd(totals.listSubtotalTwd)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{ACTUAL_SUBTOTAL_LABEL}</dt>
              <dd>{totals.blocked ? '—' : formatTwd(totals.actualSubtotalTwd)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{allowanceLabel(totals.allowanceTwd)}</dt>
              <dd>{totals.blocked ? '—' : formatTwd(Math.abs(totals.allowanceTwd))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{ITEM_COUNT_LABEL}</dt>
              <dd>{formatQty(totals.itemCount)}</dd>
            </div>
          </dl>

          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={totals.blocked}
            onClick={onAskComplete}
          >
            {COMPLETE_SALE}
          </Button>
        </div>
      </PreviewDialog>

      <PreviewDialog
        open={session.completeConfirmOpen}
        titleId="complete-sale-title"
        title={COMPLETE_SALE_CONFIRM_TITLE}
        onClose={onCancelComplete}
      >
        <p className="text-sm text-muted-foreground">{COMPLETE_SALE_CONFIRM_BODY}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" className="min-h-[44px] w-full" onClick={onComplete}>
            {COMPLETE_SALE_CONFIRM}
          </Button>
          <Button type="button" variant="outline" className="min-h-[44px] w-full" onClick={onCancelComplete}>
            {COMPLETE_SALE_CANCEL}
          </Button>
        </div>
      </PreviewDialog>
    </>
  );
}
