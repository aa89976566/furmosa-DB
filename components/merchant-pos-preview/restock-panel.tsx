'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ADD_ALL_RESTOCK,
  ADD_RESTOCK_LINE,
  AVAILABLE_QTY_LABEL,
  RESTOCK_DRAFT_TITLE,
  RESTOCK_INTRO,
  RESTOCK_QTY_LABEL,
  RESTOCK_SUBMITTED,
  RESTOCK_SUGGESTED_LABEL,
  SUBMIT_RESTOCK,
} from '@/lib/merchant-pos-preview/copy';
import { formatQty, formatTwd, stockLevelLabel } from '@/lib/merchant-pos-preview/formatters';
import { findVariant, restockCandidates } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';

export function RestockPanel({
  session,
  onQty,
  onAddLine,
  onAddAll,
  onSubmit,
}: {
  session: MerchantPosSession;
  onQty: (skuId: string, value: string) => void;
  onAddLine: (skuId: string) => void;
  onAddAll: () => void;
  onSubmit: () => void;
}) {
  const rows = restockCandidates();

  return (
    <section aria-labelledby="restock-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="restock-title" className="text-xl font-semibold text-navy">
          補貨
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{RESTOCK_INTRO}</p>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => {
          const badge = stockLevelLabel(row.stockLevel);
          const qtyId = `restock-qty-${row.variant.skuId}`;
          return (
            <li key={row.variant.skuId}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{row.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.variant.specLabel} · {row.variant.sku}
                      </p>
                      <p className="text-sm">
                        {AVAILABLE_QTY_LABEL} {formatQty(row.variant.availableQty)} ·{' '}
                        {formatTwd(row.variant.listPriceTwd)}
                      </p>
                    </div>
                    {badge ? (
                      <Badge variant={row.stockLevel === 'sold_out' ? 'destructive' : 'warning'}>
                        {badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm">
                    {RESTOCK_SUGGESTED_LABEL} {row.variant.suggestedRestockQty}
                  </p>
                  <div className="space-y-1.5">
                    <label htmlFor={qtyId} className="text-sm font-medium">
                      {RESTOCK_QTY_LABEL}
                    </label>
                    <Input
                      id={qtyId}
                      inputMode="numeric"
                      className="min-h-[44px]"
                      value={session.restockQtyBySkuId[row.variant.skuId] ?? ''}
                      disabled={session.restockSubmitted}
                      onChange={(event) => onQty(row.variant.skuId, event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full"
                    disabled={session.restockSubmitted}
                    onClick={() => onAddLine(row.variant.skuId)}
                  >
                    {ADD_RESTOCK_LINE}
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {session.restockDraft.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-navy">{RESTOCK_DRAFT_TITLE}</p>
            <ul className="space-y-1">
              {session.restockDraft.map((line) => {
                const variant = findVariant(line.skuId);
                return (
                  <li key={line.skuId}>
                    {variant?.sku} × {line.qty}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full"
        disabled={session.restockSubmitted}
        onClick={onAddAll}
      >
        {ADD_ALL_RESTOCK}
      </Button>
      <Button
        type="button"
        className="min-h-[44px] w-full"
        disabled={session.restockSubmitted || session.restockSubmitting}
        onClick={onSubmit}
      >
        {session.restockSubmitted ? RESTOCK_SUBMITTED : SUBMIT_RESTOCK}
      </Button>
    </section>
  );
}
