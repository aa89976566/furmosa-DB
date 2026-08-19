'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
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
import { PreviewDisclosure } from './preview-disclosure';

function LedgerRowView({ row }: { row: SettlementLedgerRow }) {
  return (
    <div className="mt-3">
      <p className={styles.productName}>{row.label}</p>
      <dl className={`${styles.defList} mt-2`}>
        <div className={styles.defRow}>
          <dt>{SETTLEMENT_ROW_SOURCE}</dt>
          <dd>{row.source}</dd>
        </div>
        <div className={styles.defRow}>
          <dt>{SETTLEMENT_ROW_PAYER}</dt>
          <dd>{row.payer}</dd>
        </div>
        <div className={styles.defRow}>
          <dt>{SETTLEMENT_ROW_PAYEE}</dt>
          <dd>{row.payee}</dd>
        </div>
        {row.direction ? (
          <div className={styles.defRow}>
            <dt>{SETTLEMENT_ROW_DIRECTION}</dt>
            <dd>
              {row.payer} → {row.payee}
            </dd>
          </div>
        ) : null}
        <div className={styles.defRow}>
          <dt>{SETTLEMENT_ROW_AMOUNT}</dt>
          <dd>{formatTwd(row.amountTwd)}</dd>
        </div>
        <div className={styles.defRow}>
          <dt>{SETTLEMENT_ROW_ROUTE}</dt>
          <dd>{row.periodRouteLabel}</dd>
        </div>
        <div className={styles.defRow}>
          <dt>{SETTLEMENT_ROW_NOTE}</dt>
          <dd>{row.note}</dd>
        </div>
      </dl>
      {row.kind === 'audit' ? <p className={`${styles.quietNote} mt-2`}>{AUDIT_ONLY_LABEL}</p> : null}
    </div>
  );
}

function SnapshotLedger({ row }: { row: SettlementSnapshot }) {
  return (
    <div>
      {row.ledger.map((item) => (
        <LedgerRowView key={item.rowId} row={item} />
      ))}
    </div>
  );
}

export function SettlementPanel() {
  const rows = settlementViews();

  return (
    <section aria-labelledby="settlement-title" className="min-w-0 space-y-4">
      <div>
        <h3 id="settlement-title" className={styles.sectionTitle}>
          {SETTLEMENT_TITLE}
        </h3>
        <p className={styles.sectionIntro}>{SETTLEMENT_INTRO}</p>
      </div>
      <ul className={styles.workspaceList}>
        {rows.map((row) => (
          <li key={row.settlementId} className={styles.workspaceRow}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={styles.productName}>{row.periodLabel}</p>
                <p className={styles.productSpec}>{row.netDirectionLabel}</p>
              </div>
              <p className={styles.statusText}>{row.statusLabel}</p>
            </div>
            <p className={`${styles.settlementNet} mt-3`}>
              {NET_LABEL} {row.netDirectionLabel} {formatTwd(Math.abs(row.netAmountTwd))}
            </p>
            {row.locked ? (
              <p className={`${styles.notice} mt-3`}>{row.lockNote ?? SETTLEMENT_LOCKED}</p>
            ) : null}
            <div className="mt-3">
              <PreviewDisclosure summary="查看結算明細">
                <SnapshotLedger row={row} />
              </PreviewDisclosure>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
