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
import type { MerchantPosSession, RefundRequestInput } from '@/lib/merchant-pos-preview/types';
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
  onConfirmRefund: (input: RefundRequestInput) => void;
}) {
  const sales = visibleSales(session);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [refundCondition, setRefundCondition] = useState<RefundRequestInput['condition']>('sellable_unopened');
  const [refundReason, setRefundReason] = useState('');
  const [lossReason, setLossReason] = useState('');
  const detailSale = sales.find((sale) => sale.saleId === detailSaleId) ?? null;
  const refundFormValid = refundReason.trim().length > 0 && (refundCondition === 'sellable_unopened' || lossReason.trim().length > 0);

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
                {detailSale.refund.inventoryDisposition ? <div className={styles.defRow}><dt>{REFUND_DISPOSITION_LABEL}</dt><dd>{detailSale.refund.inventoryDisposition === 'restock_sellable' ? RESTOCK_SELLABLE_LABEL : detailSale.refund.inventoryDisposition === 'loss_unsellable' ? LOSS_UNSELLABLE_LABEL : '等待總部審核'}</dd></div> : null}
                {detailSale.refund.lossReason ? <div className={styles.defRow}><dt>{REFUND_LOSS_REASON_LABEL}</dt><dd>{detailSale.refund.lossReason}</dd></div> : null}
                {detailSale.refund.nextPeriodNote ? <div className={styles.defRow}><dt>{NEXT_PERIOD_NOTE}</dt><dd>{detailSale.refund.nextPeriodNote}</dd></div> : null}
              </> : null}
            </dl>
            {detailSale.canMerchantRequestRefund ? <PreviewAction tone={PREVIEW_ACTION_TONES.requestRefund} className={styles.actionBlock} onClick={() => { setRefundCondition('sellable_unopened'); setRefundReason(''); setLossReason(''); setDetailSaleId(null); onAskRefund(detailSale.saleId); }}>{REQUEST_REFUND}</PreviewAction> : null}
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
          <label className={styles.fieldLabel} htmlFor="refund-reason">退款原因</label>
          <input id="refund-reason" className={styles.field} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="例如：客人買錯規格" />
          <label className={styles.fieldLabel} htmlFor="refund-condition">商品狀況</label>
          <select id="refund-condition" className={styles.field} value={refundCondition} onChange={(event) => setRefundCondition(event.target.value as RefundRequestInput['condition'])}>
            <option value="sellable_unopened">未拆封、狀況良好、可再販售</option>
            <option value="unsellable">已拆封、破損、變質或不可再販售</option>
          </select>
          {refundCondition === 'unsellable' ? <>
            <label className={styles.fieldLabel} htmlFor="refund-loss-reason">損耗原因</label>
            <input id="refund-loss-reason" className={styles.field} value={lossReason} onChange={(event) => setLossReason(event.target.value)} placeholder="例如：包裝破損" />
          </> : null}
          <div className={styles.notice} role="status">
            {refundCondition === 'sellable_unopened'
              ? '總部核准退款後，商品才會加回可售庫存。'
              : '總部核准退款後，商品不會加回可售庫存，並會留下損耗原因。'}
          </div>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.refundConfirm}
            className={`${styles.actionBlock} min-h-[44px]`}
            disabled={!refundFormValid}
            onClick={() => onConfirmRefund({ condition: refundCondition, reason: refundReason.trim(), lossReason: refundCondition === 'unsellable' ? lossReason.trim() : null })}
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
