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
    <details className={styles.settlementDetailRow}>
      <summary className={styles.settlementDetailSummary}>
        <span>{row.label}</span>
        <strong>{formatTwd(row.amountTwd)}</strong>
      </summary>
      <dl className={styles.defList}>
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
    </details>
  );
}

function SnapshotLedger({ row }: { row: SettlementSnapshot }) {
  const currentObligations = row.ledger.filter(
    (item) => item.kind === 'obligation' && item.periodRoute === 'this_period',
  );
  const nextPeriod = row.ledger.filter((item) => item.periodRoute === 'next_period');
  const auditRows = row.ledger.filter((item) => item.kind === 'audit');

  return (
    <div className={styles.settlementSections}>
      <section aria-labelledby="current-obligations-title">
        <h3 id="current-obligations-title" className={styles.settlementGroupTitle}>本期款項</h3>
        {currentObligations.map((item) => <LedgerRowView key={item.rowId} row={item} />)}
      </section>
      {nextPeriod.length ? (
        <section aria-labelledby="next-period-title">
          <h3 id="next-period-title" className={styles.settlementGroupTitle}>下期調整</h3>
          <p className={styles.sectionIntro}>本期不計入，將在下一期處理。</p>
          {nextPeriod.map((item) => <LedgerRowView key={item.rowId} row={item} />)}
        </section>
      ) : null}
      <section aria-labelledby="audit-rows-title">
        <h3 id="audit-rows-title" className={styles.settlementGroupTitle}>銷售對帳</h3>
        <p className={styles.sectionIntro}>只供核對收款，不影響本期應付金額。</p>
        {auditRows.map((item) => <LedgerRowView key={item.rowId} row={item} />)}
      </section>
    </div>
  );
}

export function SettlementPanel() {
  const rows = settlementViews();
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = rows.find((row) => row.settlementId === detailId) ?? null;
  const detailAmounts = detail
    ? detail.ledger.reduce(
        (result, item) => {
          if (item.kind !== 'obligation' || item.periodRoute !== 'this_period') return result;
          if (item.direction === 'merchant_owes_hq') result.merchantPays += item.amountTwd;
          if (item.direction === 'hq_owes_merchant') result.hqPays += item.amountTwd;
          return result;
        },
        { merchantPays: 0, hqPays: 0 },
      )
    : null;

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
            <div className={styles.settlementSummaryHeader}>
              <p className={styles.productName}>{detail.periodLabel}</p>
              <p className={styles.statusPill}>{detail.statusLabel}</p>
            </div>
            <p className={styles.settlementResultLabel}>本期結算結果</p>
            <p className={styles.settlementResult}>{detail.netDirectionLabel}</p>
            <p className={styles.settlementResultAmount}>{formatTwd(Math.abs(detail.netAmountTwd))}</p>
            {detailAmounts ? (
              <div className={styles.settlementEquation} aria-label="本期結算計算方式">
                <span>門市本期應付<strong>{formatTwd(detailAmounts.merchantPays)}</strong></span>
                <span>總部本期應付<strong>{formatTwd(detailAmounts.hqPays)}</strong></span>
                <span>互抵後<strong>{detail.netDirectionLabel} {formatTwd(Math.abs(detail.netAmountTwd))}</strong></span>
              </div>
            ) : null}
          </div>
          {detail.locked ? <p className={styles.notice}>{detail.lockNote ?? SETTLEMENT_LOCKED}</p> : null}
          <SnapshotLedger row={detail} />
        </div> : null}
      </PreviewDialog>
    </section>
  );
}
