'use client';

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
  SALES_INTRO,
  SALES_TITLE,
} from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { visibleSales } from '@/lib/merchant-pos-preview/selectors';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';
import { PreviewDisclosure } from './preview-disclosure';

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
        <h2 id="sales-title" className={styles.sectionTitle}>
          {SALES_TITLE}
        </h2>
        <p className={styles.sectionIntro}>{SALES_INTRO}</p>
      </div>

      <ul className={styles.workspaceList}>
        {sales.map((sale) => (
          <li key={sale.saleId} className={styles.workspaceRow}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={styles.productName}>{sale.soldAtLabel}</p>
                <p className={styles.productSpec}>{sale.channelLabel}</p>
              </div>
              <p className={styles.statusText}>{sale.statusLabel}</p>
            </div>
            <ul className={`${styles.itemList} mt-3 space-y-1`}>
              {sale.items.map((item) => (
                <li key={`${sale.saleId}-${item.name}-${item.specLabel}`}>
                  {item.name} {item.specLabel} × {item.qty} · {formatTwd(item.actualLineTwd)}
                </li>
              ))}
            </ul>
            <p className={`${styles.productMeta} mt-2`}>
              實際成交額 {formatTwd(sale.actualTotalTwd)}
              {sale.pickupLabel ? ` · ${sale.pickupLabel}` : ''}
            </p>
            {sale.refund ? (
              <dl className={`${styles.defList} mt-3`}>
                <div className={styles.defRow}>
                  <dt>退款狀態</dt>
                  <dd>{sale.refund.statusLabel}</dd>
                </div>
                <div className={styles.defRow}>
                  <dt>說明</dt>
                  <dd>{sale.refund.note}</dd>
                </div>
                <div className={styles.defRow}>
                  <dt>庫存說明</dt>
                  <dd>{sale.refund.inventoryNote}</dd>
                </div>
                <div className={styles.defRow}>
                  <dt>佣金說明</dt>
                  <dd>{sale.refund.commissionNote}</dd>
                </div>
                {sale.refund.conditionLabel ? (
                  <div className={styles.defRow}>
                    <dt>{REFUND_CONDITION_LABEL}</dt>
                    <dd>{sale.refund.conditionLabel}</dd>
                  </div>
                ) : null}
                {sale.refund.inventoryDisposition === 'restock_sellable' ? (
                  <div className={styles.defRow}>
                    <dt>{REFUND_DISPOSITION_LABEL}</dt>
                    <dd>{RESTOCK_SELLABLE_LABEL}</dd>
                  </div>
                ) : null}
                {sale.refund.inventoryDisposition === 'loss_unsellable' ? (
                  <div className={styles.defRow}>
                    <dt>{REFUND_DISPOSITION_LABEL}</dt>
                    <dd>{LOSS_UNSELLABLE_LABEL}</dd>
                  </div>
                ) : null}
                {sale.refund.lossReason ? (
                  <div className={styles.defRow}>
                    <dt>{REFUND_LOSS_REASON_LABEL}</dt>
                    <dd>{sale.refund.lossReason}</dd>
                  </div>
                ) : null}
                {sale.refund.nextPeriodNote ? (
                  <div className={styles.defRow}>
                    <dt>{NEXT_PERIOD_NOTE}</dt>
                    <dd>{sale.refund.nextPeriodNote}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {sale.canMerchantRequestRefund ? (
              <PreviewAction
                tone={PREVIEW_ACTION_TONES.requestRefund}
                className={`${styles.actionBlock} min-h-[44px] mt-3`}
                onClick={() => onAskRefund(sale.saleId)}
              >
                {REQUEST_REFUND}
              </PreviewAction>
            ) : null}
          </li>
        ))}
      </ul>

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
        <div className="mt-4">
          <PreviewDisclosure summary="查看退款說明">
            <p>{REQUEST_REFUND_BODY}</p>
          </PreviewDisclosure>
        </div>
      </PreviewDialog>
    </section>
  );
}
