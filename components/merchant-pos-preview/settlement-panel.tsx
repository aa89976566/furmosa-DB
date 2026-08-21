'use client';

import { useState } from 'react';
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
import { PreviewDialog } from './preview-dialog';

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
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = rows.find((row) => row.settlementId === detailId) ?? null;

  return (
    <section aria-labelledby="settlement-title" className="min-w-0 space-y-4">
      <div className={styles.pageHeader}>
        <h2 id="settlement-title" className={styles.sectionTitle}>
          {SETTLEMENT_TITLE}
        </h2>
        <p className={styles.sectionIntro}>{SETTLEMENT_INTRO}</p>
      </div>
      <ul className={styles.recordList}>
        {rows.map((row) => (
          <li key={row.settlementId} className={styles.recordListItem}>
            <button className={styles.recordRowButton} onClick={() => setDetailId(row.settlementId)}>
              <span className={styles.recordMain}><strong>{row.periodLabel}</strong><span>{row.netDirectionLabel}</span></span>
              <span className={styles.recordSummary}><strong>{formatTwd(Math.abs(row.netAmountTwd))}</strong><span>{row.statusLabel}</span></span>
              <span className={styles.recordChevron} aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      <PreviewDialog open={Boolean(detail)} titleId="settlement-detail-title" title="結算明細" presentation="drawer" onClose={() => setDetailId(null)}>
        {detail ? <div className={styles.drawerBody}>
          <div className={styles.drawerSummary}>
            <p className={styles.productName}>{detail.periodLabel}</p>
            <p className={styles.settlementNet}>{NET_LABEL} {detail.netDirectionLabel} {formatTwd(Math.abs(detail.netAmountTwd))}</p>
            <p className={styles.statusPill}>{detail.statusLabel}</p>
          </div>
          {detail.locked ? <p className={styles.notice}>{detail.lockNote ?? SETTLEMENT_LOCKED}</p> : null}
          <SnapshotLedger row={detail} />
        </div> : null}
      </PreviewDialog>
    </section>
  );
}
