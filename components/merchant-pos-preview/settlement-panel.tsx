'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CHANNEL_COMMISSION_LABEL,
  CHANNEL_NET_LABEL,
  CHANNEL_REFUND_LABEL,
  CHANNEL_SUBSIDY_LABEL,
  FURMOSA_CHANNEL_LABEL,
  FURMOSA_COLLECTED_LABEL,
  MERCHANT_CHANNEL_LABEL,
  MERCHANT_COLLECTED_LABEL,
  NET_LABEL,
  ORDINARY_COMMISSION_LABEL,
  REFUND_ADJUSTMENT_LABEL,
  SETTLEMENT_EQ_FURMOSA,
  SETTLEMENT_EQ_MERCHANT,
  SETTLEMENT_EQ_TOTAL,
  SETTLEMENT_INTRO,
  SETTLEMENT_LOCKED,
  SETTLEMENT_TITLE,
  VOUCHER_SUBSIDY_LABEL,
} from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { settlementViews } from '@/lib/merchant-pos-preview/selectors';
import type { SettlementSnapshot } from '@/lib/merchant-pos-preview/types';

function statusVariant(status: string) {
  if (status === 'paid' || status === 'approved') return 'success' as const;
  if (status === 'reviewing') return 'warning' as const;
  return 'secondary' as const;
}

function ChannelBlock({
  title,
  salesLabel,
  sales,
  commission,
  subsidy,
  refundAdj,
  net,
}: {
  title: string;
  salesLabel: string;
  sales: number;
  commission: number;
  subsidy: number;
  refundAdj: number;
  net: number;
}) {
  return (
    <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
      <p className="font-medium text-navy">{title}</p>
      <dl className="space-y-1">
        <div className="flex justify-between gap-3">
          <dt>{salesLabel}</dt>
          <dd>{formatTwd(sales)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{CHANNEL_COMMISSION_LABEL}</dt>
          <dd>{formatTwd(commission)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{CHANNEL_SUBSIDY_LABEL}</dt>
          <dd>{formatTwd(subsidy)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{CHANNEL_REFUND_LABEL}</dt>
          <dd>{formatTwd(refundAdj)}</dd>
        </div>
        <div className="flex justify-between gap-3 font-medium">
          <dt>{CHANNEL_NET_LABEL}</dt>
          <dd>{formatTwd(net)}</dd>
        </div>
      </dl>
    </div>
  );
}

function SnapshotRows({ row }: { row: SettlementSnapshot }) {
  return (
    <>
      <ChannelBlock
        title={MERCHANT_CHANNEL_LABEL}
        salesLabel={MERCHANT_COLLECTED_LABEL}
        sales={row.merchantCollectedSalesTwd}
        commission={row.merchantCollectedCommissionTwd}
        subsidy={row.merchantCollectedVoucherSubsidyTwd}
        refundAdj={row.merchantCollectedRefundAdjustmentTwd}
        net={row.merchantCollectedNetTwd}
      />
      <ChannelBlock
        title={FURMOSA_CHANNEL_LABEL}
        salesLabel={FURMOSA_COLLECTED_LABEL}
        sales={row.furmosaCollectedSalesTwd}
        commission={row.furmosaCollectedCommissionTwd}
        subsidy={row.furmosaCollectedVoucherSubsidyTwd}
        refundAdj={row.furmosaCollectedRefundAdjustmentTwd}
        net={row.furmosaCollectedNetTwd}
      />
      <dl className="space-y-1 text-sm">
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
          <dd>
            {row.netDirectionLabel} {formatTwd(row.netAmountTwd)}
          </dd>
        </div>
      </dl>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{SETTLEMENT_EQ_MERCHANT}</p>
        <p>
          {formatTwd(row.merchantCollectedSalesTwd)} − {formatTwd(row.merchantCollectedCommissionTwd)} +{' '}
          {formatTwd(row.merchantCollectedVoucherSubsidyTwd)} − {formatTwd(row.merchantCollectedRefundAdjustmentTwd)} ={' '}
          {formatTwd(row.merchantCollectedNetTwd)}
        </p>
        <p>{SETTLEMENT_EQ_FURMOSA}</p>
        <p>
          {formatTwd(row.furmosaCollectedSalesTwd)} − {formatTwd(row.furmosaCollectedCommissionTwd)} +{' '}
          {formatTwd(row.furmosaCollectedVoucherSubsidyTwd)} − {formatTwd(row.furmosaCollectedRefundAdjustmentTwd)} ={' '}
          {formatTwd(row.furmosaCollectedNetTwd)}
        </p>
        <p>{SETTLEMENT_EQ_TOTAL}</p>
        <p>
          {formatTwd(row.merchantCollectedNetTwd)} + {formatTwd(row.furmosaCollectedNetTwd)} = {formatTwd(row.netAmountTwd)}
        </p>
      </div>
    </>
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
                <SnapshotRows row={row} />
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
