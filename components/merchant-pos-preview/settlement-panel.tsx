'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AUDIT_ONLY_LABEL,
  NET_LABEL,
  SETTLEMENT_INTRO,
  SETTLEMENT_LOCKED,
  SETTLEMENT_ROW_AMOUNT,
  SETTLEMENT_ROW_DIRECTION,
  SETTLEMENT_ROW_NOTE,
  SETTLEMENT_ROW_PAYEE,
  SETTLEMENT_ROW_PAYER,
  SETTLEMENT_ROW_ROUTE,
  SETTLEMENT_ROW_SOURCE,
  SETTLEMENT_TITLE,
} from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { settlementViews } from '@/lib/merchant-pos-preview/selectors';
import type { SettlementLedgerRow, SettlementSnapshot } from '@/lib/merchant-pos-preview/types';

function statusVariant(status: string) {
  if (status === 'paid' || status === 'approved') return 'success' as const;
  if (status === 'reviewing') return 'warning' as const;
  return 'secondary' as const;
}

function LedgerRowView({ row }: { row: SettlementLedgerRow }) {
  return (
    <li className="rounded-xl bg-muted/60 p-3 text-sm">
      <p className="font-medium text-navy">{row.label}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between gap-3">
          <dt>{SETTLEMENT_ROW_SOURCE}</dt>
          <dd className="text-right">{row.source}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{SETTLEMENT_ROW_PAYER}</dt>
          <dd>{row.payer}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{SETTLEMENT_ROW_PAYEE}</dt>
          <dd>{row.payee}</dd>
        </div>
        {row.direction ? (
          <div className="flex justify-between gap-3">
            <dt>{SETTLEMENT_ROW_DIRECTION}</dt>
            <dd className="text-right">
              {row.payer} → {row.payee}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt>{SETTLEMENT_ROW_AMOUNT}</dt>
          <dd>{formatTwd(row.amountTwd)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{SETTLEMENT_ROW_ROUTE}</dt>
          <dd>{row.periodRouteLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{SETTLEMENT_ROW_NOTE}</dt>
          <dd className="text-right text-muted-foreground">{row.note}</dd>
        </div>
      </dl>
      {row.kind === 'audit' ? (
        <p className="mt-2 text-xs text-muted-foreground">{AUDIT_ONLY_LABEL}</p>
      ) : null}
    </li>
  );
}

function SnapshotLedger({ row }: { row: SettlementSnapshot }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {row.ledger.map((item) => (
          <LedgerRowView key={item.rowId} row={item} />
        ))}
      </ul>
      <p className="text-sm font-medium text-navy">
        {NET_LABEL} {row.netDirectionLabel} {formatTwd(Math.abs(row.netAmountTwd))}
      </p>
    </div>
  );
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
                <SnapshotLedger row={row} />
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
