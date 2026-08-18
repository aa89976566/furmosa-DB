'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ADD_TO_CART,
  AVAILABLE_QTY_LABEL,
  CART_EMPTY,
  CHECKOUT_INTRO,
  LIST_PRICE_LABEL,
  SEARCH_EMPTY,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SELECT_SPEC_HINT,
  VIEW_RESTOCK,
} from '@/lib/merchant-pos-preview/copy';
import { formatQty, formatTwd, stockLevelLabel } from '@/lib/merchant-pos-preview/formatters';
import { catalogRows } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';

export function CheckoutPanel({
  session,
  onQuery,
  onSelectVariant,
  onAdd,
  onViewRestock,
}: {
  session: MerchantPosSession;
  onQuery: (query: string) => void;
  onSelectVariant: (productId: string, skuId: string) => void;
  onAdd: (productId: string) => void;
  onViewRestock: () => void;
}) {
  const rows = catalogRows(session);

  return (
    <section aria-labelledby="checkout-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="checkout-title" className="text-xl font-semibold text-navy">
          收銀
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{CHECKOUT_INTRO}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="product-search" className="text-sm font-medium text-navy">
          {SEARCH_LABEL}
        </label>
        <Input
          id="product-search"
          value={session.query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          className="min-h-[44px]"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">{SEARCH_EMPTY}</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const selected = row.selected;
            const soldOut = selected?.availableQty === 0;
            const badge = selected ? stockLevelLabel(row.stockLevel ?? 'normal') : null;
            return (
              <li key={row.product.productId}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="font-semibold text-navy">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        貨號 {row.product.variants.map((variant) => variant.sku).join('／')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.product.variants.map((variant) => {
                        const pressed = selected?.skuId === variant.skuId;
                        return (
                          <Button
                            key={variant.skuId}
                            type="button"
                            variant={pressed ? 'default' : 'outline'}
                            className="min-h-[44px]"
                            aria-pressed={pressed}
                            onClick={() => onSelectVariant(row.product.productId, variant.skuId)}
                          >
                            {variant.specLabel}
                          </Button>
                        );
                      })}
                    </div>
                    {selected ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>
                          {LIST_PRICE_LABEL} {formatTwd(selected.listPriceTwd)}
                        </span>
                        <span>
                          {AVAILABLE_QTY_LABEL} {formatQty(selected.availableQty)}
                        </span>
                        {badge ? (
                          <Badge variant={soldOut ? 'destructive' : 'warning'}>{badge}</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{SELECT_SPEC_HINT}</p>
                    )}
                    {soldOut ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px] w-full"
                        onClick={onViewRestock}
                      >
                        {VIEW_RESTOCK}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="min-h-[44px] w-full"
                        disabled={!selected}
                        onClick={() => onAdd(row.product.productId)}
                      >
                        {ADD_TO_CART}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {session.cart.length === 0 ? (
        <p className="text-sm text-muted-foreground">{CART_EMPTY}</p>
      ) : null}
    </section>
  );
}
