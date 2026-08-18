'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  NEXT_PERIOD_NOTE,
  REQUEST_REFUND,
  REQUEST_REFUND_BODY,
  REQUEST_REFUND_CANCEL,
  REQUEST_REFUND_CONFIRM,
  REQUEST_REFUND_TITLE,
  SALES_INTRO,
} from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { visibleSales } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { PreviewDialog } from './preview-dialog';

function refundBadgeVariant(status: string) {
  if (status === 'rejected') return 'destructive' as const;
  if (status === 'completed' || status === 'approved') return 'success' as const;
  return 'warning' as const;
}

export function SalesPanel({
  session,
  onAskRefund,
  onCancelRefund,
  onConfirmRefund,
}: {
  session: MerchantPosSession;
  onAskRefund: (saleId: string) => void;
  onCancelRefund: () => void;
  onConfirmRefund: () => void;
}) {
  const sales = visibleSales(session);

  return (
    <section aria-labelledby="sales-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="sales-title" className="text-xl font-semibold text-navy">
          銷售與退款
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{SALES_INTRO}</p>
      </div>

      <ul className="space-y-3">
        {sales.map((sale) => (
          <li key={sale.saleId}>
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{sale.soldAtLabel}</p>
                    <p className="text-sm text-muted-foreground">{sale.channelLabel}</p>
                  </div>
                  <Badge variant="secondary">{sale.statusLabel}</Badge>
                </div>
                <ul className="space-y-1 text-sm">
                  {sale.items.map((item) => (
                    <li key={`${sale.saleId}-${item.name}-${item.specLabel}`}>
                      {item.name} {item.specLabel} × {item.qty} · {formatTwd(item.actualLineTwd)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-medium">
                  實際成交額 {formatTwd(sale.actualTotalTwd)}
                  {sale.pickupLabel ? ` · ${sale.pickupLabel}` : ''}
                </p>
                {sale.refund ? (
                  <div className="space-y-1 rounded-xl bg-muted/70 p-3 text-sm">
                    <Badge variant={refundBadgeVariant(sale.refund.status)}>
                      {sale.refund.statusLabel}
                    </Badge>
                    <p>{sale.refund.note}</p>
                    <p className="text-muted-foreground">{sale.refund.inventoryNote}</p>
                    <p className="text-muted-foreground">{sale.refund.commissionNote}</p>
                    {sale.refund.nextPeriodNote ? (
                      <p className="font-medium text-navy">
                        {NEXT_PERIOD_NOTE}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {sale.canMerchantRequestRefund ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full"
                    onClick={() => onAskRefund(sale.saleId)}
                  >
                    {REQUEST_REFUND}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <PreviewDialog
        open={Boolean(session.refundConfirmSaleId)}
        titleId="refund-confirm-title"
        title={REQUEST_REFUND_TITLE}
        onClose={onCancelRefund}
      >
        <p className="text-sm text-muted-foreground">{REQUEST_REFUND_BODY}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" className="min-h-[44px] w-full" onClick={onConfirmRefund}>
            {REQUEST_REFUND_CONFIRM}
          </Button>
          <Button type="button" variant="outline" className="min-h-[44px] w-full" onClick={onCancelRefund}>
            {REQUEST_REFUND_CANCEL}
          </Button>
        </div>
      </PreviewDialog>
    </section>
  );
}
