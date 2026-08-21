'use client';

import { useMemo, useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  ADD_ALL_RESTOCK,
  ADD_RESTOCK_LINE,
  CLOSE_DIALOG,
  REMOVE_RESTOCK_LINE,
  RESTOCK_DRAFT_TITLE,
  RESTOCK_QTY_LABEL,
  RESTOCK_SUBMITTED,
  RESTOCK_SUGGESTED_LABEL,
  SUBMIT_RESTOCK,
  UPDATE_RESTOCK_LINE,
  VIEW_RESTOCK_ORDER,
} from '@/lib/merchant-pos-preview/copy';
import { formatQty, stockLevelLabel } from '@/lib/merchant-pos-preview/formatters';
import { findProductBySku, findVariant, restockCandidates } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';

export function RestockPanel({
  session,
  onQty,
  onAddLine,
  onAddAll,
  onRemoveLine,
  onSubmit,
}: {
  session: MerchantPosSession;
  onQty: (skuId: string, value: string) => void;
  onAddLine: (skuId: string) => void;
  onAddAll: () => void;
  onRemoveLine: (skuId: string) => void;
  onSubmit: () => void;
}) {
  const [orderOpen, setOrderOpen] = useState(false);
  const rows = restockCandidates();
  const draftBySku = useMemo(
    () => new Map(session.restockDraft.map((line) => [line.skuId, line.qty])),
    [session.restockDraft],
  );
  const suggestedTotal = rows.reduce((sum, row) => sum + row.variant.suggestedRestockQty, 0);
  const draftTotal = session.restockDraft.reduce((sum, line) => sum + line.qty, 0);

  return (
    <section aria-labelledby="restock-title" className="min-w-0 space-y-4">
      <div className={styles.pageHeader}>
        <h2 id="restock-title" className={styles.sectionTitle}>補貨</h2>
        <p className={styles.sectionIntro}>依目前庫存與建議補貨量建立補貨申請。</p>
        <div className={styles.restockSummary} aria-label="補貨摘要">
          <strong>{rows.length} 項需要補貨</strong>
          <span>建議共 {suggestedTotal} 件</span>
          <button
            type="button"
            className={styles.textAction}
            disabled={session.restockSubmitted}
            onClick={onAddAll}
          >
            {ADD_ALL_RESTOCK}
          </button>
        </div>
      </div>

      <ul className={styles.restockList}>
        {rows.map((row) => {
          const badge = stockLevelLabel(row.stockLevel) === '售罄' ? '缺貨' : '低庫存';
          const qtyId = `restock-qty-${row.variant.skuId}`;
          const selectedQty = draftBySku.get(row.variant.skuId);
          return (
            <li key={row.variant.skuId} className={styles.restockRow}>
              <div className={styles.restockIdentity}>
                <p className={styles.productName}>{row.product.name}</p>
                <p className={styles.productSpec}>{row.variant.specLabel}</p>
                <p className={styles.restockSku}>{row.variant.sku}</p>
              </div>
              <div className={styles.restockMetric}>
                <span>目前庫存</span>
                <strong>{formatQty(row.variant.availableQty)}</strong>
                <small>{badge}</small>
              </div>
              <div className={styles.restockMetric}>
                <span>{RESTOCK_SUGGESTED_LABEL}</span>
                <strong>{row.variant.suggestedRestockQty} 件</strong>
              </div>
              <div className={styles.restockQtyControl}>
                <label htmlFor={qtyId}>{RESTOCK_QTY_LABEL}</label>
                <input
                  id={qtyId}
                  inputMode="numeric"
                  className={styles.field}
                  value={session.restockQtyBySkuId[row.variant.skuId] ?? ''}
                  disabled={session.restockSubmitted}
                  onChange={(event) => onQty(row.variant.skuId, event.target.value)}
                />
              </div>
              <PreviewAction
                tone={selectedQty ? 'secondary' : PREVIEW_ACTION_TONES.addRestockLine}
                className={styles.restockRowAction}
                disabled={session.restockSubmitted}
                onClick={() => onAddLine(row.variant.skuId)}
              >
                {selectedQty ? UPDATE_RESTOCK_LINE : ADD_RESTOCK_LINE}
              </PreviewAction>
            </li>
          );
        })}
      </ul>

      {session.restockNotice ? (
        <p className={styles.notice} role="status">{session.restockNotice}</p>
      ) : null}

      <div className={styles.restockDock}>
        <div>
          <strong>{RESTOCK_DRAFT_TITLE}</strong>
          <p>{session.restockDraft.length} 項・共 {draftTotal} 件</p>
        </div>
        <PreviewAction
          tone="secondary"
          disabled={session.restockDraft.length === 0}
          onClick={() => setOrderOpen(true)}
        >
          {VIEW_RESTOCK_ORDER}
        </PreviewAction>
        <PreviewAction
          tone={PREVIEW_ACTION_TONES.submitRestock}
          disabled={session.restockDraft.length === 0 || session.restockSubmitted || session.restockSubmitting}
          onClick={() => setOrderOpen(true)}
        >
          {session.restockSubmitted ? RESTOCK_SUBMITTED : SUBMIT_RESTOCK}
        </PreviewAction>
      </div>

      <PreviewDialog
        open={orderOpen}
        titleId="restock-order-title"
        title={RESTOCK_DRAFT_TITLE}
        presentation="drawer"
        onClose={() => setOrderOpen(false)}
      >
        <div className={styles.restockOrderSummary}>
          <p>送達門市　<strong>測試門市</strong></p>
          <p>{session.restockDraft.length} 項商品・共 {draftTotal} 件</p>
        </div>
        <ul className={styles.restockOrderLines}>
          {session.restockDraft.map((line) => {
            const product = findProductBySku(line.skuId);
            const variant = findVariant(line.skuId);
            return (
              <li key={line.skuId}>
                <div>
                  <strong>{product?.name}</strong>
                  <p>{variant?.specLabel}・{line.qty} 件</p>
                </div>
                <button
                  type="button"
                  className={styles.dangerTextAction}
                  disabled={session.restockSubmitted}
                  onClick={() => onRemoveLine(line.skuId)}
                >
                  {REMOVE_RESTOCK_LINE}
                </button>
              </li>
            );
          })}
        </ul>
        <div className={styles.dialogActions}>
          <PreviewAction tone="secondary" onClick={() => setOrderOpen(false)}>{CLOSE_DIALOG}</PreviewAction>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.submitRestock}
            disabled={session.restockDraft.length === 0 || session.restockSubmitted}
            onClick={() => { onSubmit(); setOrderOpen(false); }}
          >
            {SUBMIT_RESTOCK}
          </PreviewAction>
        </div>
      </PreviewDialog>
    </section>
  );
}
