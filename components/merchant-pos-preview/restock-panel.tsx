'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
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
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDisclosure } from './preview-disclosure';

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
      <div className={styles.pageHeader}>
        <h2 id="restock-title" className={styles.sectionTitle}>
          補貨
        </h2>
        <PreviewDisclosure summary="查看補貨流程">
          <p>{RESTOCK_INTRO}</p>
        </PreviewDisclosure>
      </div>

      <ul className={styles.workspaceGrid}>
        {rows.map((row) => {
          const badge = stockLevelLabel(row.stockLevel);
          const qtyId = `restock-qty-${row.variant.skuId}`;
          return (
            <li key={row.variant.skuId} className={styles.workspaceCard}>
              <p className={styles.productName}>{row.product.name}</p>
              <p className={styles.productSpec}>
                {row.variant.specLabel} · {row.variant.sku}
              </p>
              <p className={`${styles.productMeta} mt-1`}>
                {AVAILABLE_QTY_LABEL} {formatQty(row.variant.availableQty)} ·{' '}
                {formatTwd(row.variant.listPriceTwd)}
              </p>
              {badge ? (
                <p
                  className={
                    row.stockLevel === 'sold_out' ? styles.stockMarkSoldOut : styles.stockMark
                  }
                >
                  {badge}
                </p>
              ) : null}
              <p className={`${styles.productMeta} mt-2`}>
                {RESTOCK_SUGGESTED_LABEL} {row.variant.suggestedRestockQty}
              </p>
              <div className={`${styles.restockControls} mt-3 space-y-1.5`}>
                <label htmlFor={qtyId} className={styles.fieldLabel}>
                  {RESTOCK_QTY_LABEL}
                </label>
                <input
                  id={qtyId}
                  inputMode="numeric"
                  className={`${styles.field} min-h-[44px]`}
                  value={session.restockQtyBySkuId[row.variant.skuId] ?? ''}
                  disabled={session.restockSubmitted}
                  onChange={(event) => onQty(row.variant.skuId, event.target.value)}
                />
                <PreviewAction
                  tone={PREVIEW_ACTION_TONES.addRestockLine}
                  className={`${styles.actionBlock} min-h-[44px] mt-3`}
                  disabled={session.restockSubmitted}
                  onClick={() => onAddLine(row.variant.skuId)}
                >
                  {ADD_RESTOCK_LINE}
                </PreviewAction>
              </div>
            </li>
          );
        })}
      </ul>

      {session.restockDraft.length > 0 ? (
        <div className={styles.notice}>
          <p className={styles.productName}>{RESTOCK_DRAFT_TITLE}</p>
          <ul className={`${styles.itemList} mt-2 space-y-1`}>
            {session.restockDraft.map((line) => {
              const variant = findVariant(line.skuId);
              return (
                <li key={line.skuId}>
                  {variant?.sku} × {line.qty}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className={styles.pageActions}>
        <PreviewAction
          tone={PREVIEW_ACTION_TONES.addAllRestock}
          className={`${styles.actionBlock} min-h-[44px]`}
          disabled={session.restockSubmitted}
          onClick={onAddAll}
        >
          {ADD_ALL_RESTOCK}
        </PreviewAction>
        <PreviewAction
          tone={PREVIEW_ACTION_TONES.submitRestock}
          className={`${styles.actionBlock} min-h-[44px]`}
          disabled={session.restockSubmitted || session.restockSubmitting}
          onClick={onSubmit}
        >
          {session.restockSubmitted ? RESTOCK_SUBMITTED : SUBMIT_RESTOCK}
        </PreviewAction>
      </div>
    </section>
  );
}
