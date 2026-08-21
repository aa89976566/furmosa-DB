'use client';

import { useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  LOSS_UNSELLABLE_LABEL,
  NEXT_PERIOD_NOTE,
  REFUND_CONDITION_LABEL,
  REFUND_DISPOSITION_LABEL,
  REFUND_LOSS_REASON_LABEL,
  REQUEST_REFUND,
  REQUEST_REFUND_BODY,
  REQUEST_REFUND_CANCEL,
  REQUEST_REFUND_CONFIRM,
  REQUEST_REFUND_TITLE,
  RESTOCK_SELLABLE_LABEL,
  SALES_TITLE,
} from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { visibleSales } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';

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
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const detailSale = sales.find((sale) => sale.saleId === detailSaleId) ?? null;

  return (
    <section aria-labelledby="sales-title" className="min-w-0 space-y-4">
      <div className={styles.pageHeader}>
        <h2 id="sales-title" className={styles.sectionTitle}>
          {SALES_TITLE}
        </h2>
      </div>

      <ul className={styles.recordList}>
        {sales.map((sale) => (
          <li key={sale.saleId} className={styles.recordListItem}>
            <button className={styles.recordRowButton} onClick={() => setDetailSaleId(sale.saleId)}>
              <span className={styles.recordMain}>
                <strong>{sale.soldAtLabel}</strong>
                <span>{sale.channelLabel}</span>
              </span>
              <span className={styles.recordSummary}>
                <strong>{formatTwd(sale.actualTotalTwd)}</strong>
                <span>{sale.refund?.statusLabel ?? sale.statusLabel}</span>
              </span>
              <span className={styles.recordChevron} aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>

      <PreviewDialog
        open={Boolean(detailSale)}
        titleId="sale-detail-title"
        title="銷售明細"
        presentation="drawer"
        onClose={() => setDetailSaleId(null)}
      >
        {detailSale ? (
          <div className={styles.drawerBody}>
            <div className={styles.drawerSummary}>
              <p className={styles.productName}>{detailSale.soldAtLabel}</p>
              <p className={styles.productSpec}>{detailSale.channelLabel}</p>
              <p className={styles.settlementNet}>{formatTwd(detailSale.actualTotalTwd)}</p>
              <p className={styles.statusPill}>{detailSale.refund?.statusLabel ?? detailSale.statusLabel}</p>
            </div>
            <dl className={styles.defList}>
              <div className={styles.defRow}><dt>商品</dt><dd>{detailSale.items.map((item) => `${item.name} ${item.specLabel} × ${item.qty}`).join('、')}</dd></div>
              <div className={styles.defRow}><dt>實際成交額</dt><dd>{formatTwd(detailSale.actualTotalTwd)}</dd></div>
              {detailSale.pickupLabel ? <div className={styles.defRow}><dt>取貨方式</dt><dd>{detailSale.pickupLabel}</dd></div> : null}
              {detailSale.refund ? <>
                <div className={styles.defRow}><dt>退款狀態</dt><dd>{detailSale.refund.statusLabel}</dd></div>
                <div className={styles.defRow}><dt>說明</dt><dd>{detailSale.refund.note}</dd></div>
                <div className={styles.defRow}><dt>庫存說明</dt><dd>{detailSale.refund.inventoryNote}</dd></div>
                <div className={styles.defRow}><dt>佣金說明</dt><dd>{detailSale.refund.commissionNote}</dd></div>
                {detailSale.refund.conditionLabel ? <div className={styles.defRow}><dt>{REFUND_CONDITION_LABEL}</dt><dd>{detailSale.refund.conditionLabel}</dd></div> : null}
                {detailSale.refund.inventoryDisposition ? <div className={styles.defRow}><dt>{REFUND_DISPOSITION_LABEL}</dt><dd>{detailSale.refund.inventoryDisposition === 'restock_sellable' ? RESTOCK_SELLABLE_LABEL : LOSS_UNSELLABLE_LABEL}</dd></div> : null}
                {detailSale.refund.lossReason ? <div className={styles.defRow}><dt>{REFUND_LOSS_REASON_LABEL}</dt><dd>{detailSale.refund.lossReason}</dd></div> : null}
                {detailSale.refund.nextPeriodNote ? <div className={styles.defRow}><dt>{NEXT_PERIOD_NOTE}</dt><dd>{detailSale.refund.nextPeriodNote}</dd></div> : null}
              </> : null}
            </dl>
            {detailSale.canMerchantRequestRefund ? <PreviewAction tone={PREVIEW_ACTION_TONES.requestRefund} className={styles.actionBlock} onClick={() => { setDetailSaleId(null); onAskRefund(detailSale.saleId); }}>{REQUEST_REFUND}</PreviewAction> : null}
          </div>
        ) : null}
      </PreviewDialog>

      <PreviewDialog
        open={Boolean(session.refundConfirmSaleId)}
        titleId="refund-confirm-title"
        title={REQUEST_REFUND_TITLE}
        onClose={onCancelRefund}
      >
        <div className={styles.stack}>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.refundConfirm}
            className={`${styles.actionBlock} min-h-[44px]`}
            onClick={onConfirmRefund}
          >
            {REQUEST_REFUND_CONFIRM}
          </PreviewAction>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.refundCancel}
            className={`${styles.actionBlock} min-h-[44px]`}
            onClick={onCancelRefund}
          >
            {REQUEST_REFUND_CANCEL}
          </PreviewAction>
        </div>
        <p className={`${styles.quietNote} mt-4`}>{REQUEST_REFUND_BODY}</p>
      </PreviewDialog>
    </section>
  );
}
