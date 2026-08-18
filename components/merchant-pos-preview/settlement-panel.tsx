'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  FURMOSA_COLLECTED_LABEL,
  MERCHANT_COLLECTED_LABEL,
  NET_LABEL,
  ORDINARY_COMMISSION_LABEL,
  REFUND_ADJUSTMENT_LABEL,
  SETTLEMENT_INTRO,
  SETTLEMENT_LOCKED,
  SETTLEMENT_TITLE,
  VOUCHER_SUBSIDY_LABEL,
} from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { settlementViews } from '@/lib/merchant-pos-preview/selectors';

function statusVariant(status: string) {
  if (status === 'paid' || status === 'approved') return 'success' as const;
  if (status === 'reviewing') return 'warning' as const;
  return 'secondary' as const;
}

export function SettlementPanel() {
  const rows = settlementViews();

  return (
    <section aria-labelledby="settlement-title" className="min-w-0 space-y-4">
      <div>
        <h3 id="settlement-title" className="text-lg font-semibold text-navy">
          {SETTLEMENT_TITLE}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{SETTLEMENT_INTRO}</p>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.settlementId}>
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{row.periodLabel}</p>
                    <p className="text-sm text-muted-foreground">{row.netDirectionLabel}</p>
                  </div>
                  <Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge>
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt>{MERCHANT_COLLECTED_LABEL}</dt>
                    <dd>{formatTwd(row.merchantCollectedSalesTwd)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>{FURMOSA_COLLECTED_LABEL}</dt>
                    <dd>{formatTwd(row.furmosaCollectedSalesTwd)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>{ORDINARY_COMMISSION_LABEL}</dt>
                    <dd>{formatTwd(row.ordinaryCommissionSnapshotTwd)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>{VOUCHER_SUBSIDY_LABEL}</dt>
                    <dd>{formatTwd(row.voucherFixedSubsidyTwd)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>{REFUND_ADJUSTMENT_LABEL}</dt>
                    <dd>{formatTwd(row.refundNextPeriodAdjustmentTwd)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 font-medium text-navy">
                    <dt>{NET_LABEL}</dt>
                    <dd>{formatTwd(row.netAmountTwd)}</dd>
                  </div>
                </dl>
                {row.locked ? (
                  <p className="rounded-xl bg-muted/70 p-3 text-sm font-medium text-navy">
                    {row.lockNote ?? SETTLEMENT_LOCKED}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
