'use client';

import { useMemo, useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import { REFILL_INTRO, REFILL_TITLE } from '@/lib/merchant-pos-preview/copy';
import { formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { parsePreviewOldJarSerial } from '@/lib/merchant-pos-preview/validators';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';
import {
  actionableRefillOrders,
  blockedRefillOrders,
  canConfirmRefillDelivery,
  initialRefillStage,
  nextActionableRefillOrder,
  REFILL_PREVIEW_ORDERS,
  type RefillDeliveryStage,
  type RefillPreviewOrder,
} from './refill-preview-state';

type SerialEntry = { value: string; verified: boolean; error: string | null };

function serialEntries(order: RefillPreviewOrder): SerialEntry[] {
  return Array.from({ length: order.quantity }, () => ({ value: '', verified: false, error: null }));
}

export function RefillPanel() {
  const actionable = useMemo(() => actionableRefillOrders(REFILL_PREVIEW_ORDERS), []);
  const blocked = useMemo(() => blockedRefillOrders(REFILL_PREVIEW_ORDERS), []);
  const [selectedOrder, setSelectedOrder] = useState<RefillPreviewOrder | null>(null);
  const [entries, setEntries] = useState<SerialEntry[]>([]);
  const [stage, setStage] = useState<RefillDeliveryStage>('verify');
  const [completedOrderIds, setCompletedOrderIds] = useState<Set<string>>(new Set());

  function openOrder(order: RefillPreviewOrder) {
    setSelectedOrder(order);
    setEntries(serialEntries(order));
    setStage(completedOrderIds.has(order.orderId) ? 'completed' : initialRefillStage(order));
  }

  function closeOrder() {
    setSelectedOrder(null);
  }

  function updateSerial(index: number, value: string) {
    setEntries((current) => current.map((entry, entryIndex) =>
      entryIndex === index
        ? { value: value.replace(/\D/g, '').slice(0, 8), verified: false, error: null }
        : entry,
    ));
  }

  function verifySerial(index: number) {
    if (!selectedOrder) return;
    setEntries((current) => {
      const entry = current[index];
      if (!entry) return current;
      const parsed = parsePreviewOldJarSerial(entry.value);
      if (!parsed.ok) {
        return current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, verified: false, error: parsed.error } : item,
        );
      }
      if (current.some((item, itemIndex) => itemIndex !== index && item.value === parsed.value)) {
        return current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, verified: false, error: '這個序號已在本次交付中使用' } : item,
        );
      }
      if (selectedOrder.expectedOldSerials[index] !== parsed.value) {
        return current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, verified: false, error: '找不到可用資格，或序號不屬於此會員' }
            : item,
        );
      }
      return current.map((item, itemIndex) =>
        itemIndex === index ? { value: parsed.value, verified: true, error: null } : item,
      );
    });
  }

  function completeDelivery() {
    if (!selectedOrder || !canConfirmRefillDelivery(selectedOrder, entries.map((entry) => entry.verified))) return;
    setCompletedOrderIds((current) => new Set(current).add(selectedOrder.orderId));
    setStage('completed');
  }

  function openNextOrder() {
    if (!selectedOrder) return;
    const next = nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, selectedOrder.orderId, completedOrderIds);
    if (next) openOrder(next);
    else closeOrder();
  }

  const allVerified = selectedOrder
    ? canConfirmRefillDelivery(selectedOrder, entries.map((entry) => entry.verified))
    : false;
  const nextOrder = selectedOrder
    ? nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, selectedOrder.orderId, completedOrderIds)
    : null;

  return (
    <section aria-labelledby="refill-title" className="min-w-0 space-y-6">
      <div className={styles.pageHeader}>
        <h2 id="refill-title" className={styles.sectionTitle}>{REFILL_TITLE}</h2>
        <p className={styles.sectionIntro}>{REFILL_INTRO}</p>
      </div>

      <div className={styles.refillQueueSummary} aria-label="待換罐摘要">
        <span><strong>{actionable.length}</strong> 筆可處理</span>
        <span>{blocked.length} 筆付款或庫存尚未完成</span>
      </div>

      <ul className={styles.recordList}>
        {actionable.map((order) => {
          const completed = completedOrderIds.has(order.orderId);
          return (
            <li key={order.orderId} className={styles.recordListItem}>
              <button type="button" className={styles.recordRowButton} onClick={() => openOrder(order)}>
                <span className={styles.recordMain}>
                  <strong>{order.appointmentTime} · {order.petLabel}</strong>
                  <span>{order.productLabel} × {order.quantity}</span>
                  <span>{order.purchaseMode === 'exchange' ? `換罐 · 需收回 ${order.quantity} 個空罐` : '首罐 · 不需回收空罐'}</span>
                </span>
                <span className={styles.recordSummary}>
                  <strong>{completed ? '已交付（預覽）' : order.arrived ? '已到店' : '已付款'}</strong>
                  <span>{completed ? '流程完成' : '已保留門市庫存'}</span>
                </span>
                <span className={styles.recordChevron} aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>

      {blocked.length > 0 ? (
        <details className={styles.disclosure}>
          <summary className={styles.disclosureSummary}>付款未完成 {blocked.length} 筆</summary>
          <div className={styles.disclosureBody}>
            {blocked.map((order) => (
              <p key={order.orderId} className={styles.quietNote}>
                {order.appointmentTime} · {order.petLabel} · {order.productLabel}：尚未付款，不列入待交付。
              </p>
            ))}
          </div>
        </details>
      ) : null}

      <PreviewDialog
        open={Boolean(selectedOrder)}
        titleId={`refill-order-title-${stage}`}
        title={stage === 'completed' ? '交付完成' : stage === 'confirm' ? '確認交付' : '換罐交付'}
        presentation="drawer"
        onClose={closeOrder}
      >
        {selectedOrder ? (
          <div className={styles.drawerBody}>
            <dl className={styles.defList}>
              <div className={styles.defRow}><dt>訂單</dt><dd>{selectedOrder.orderId}</dd></div>
              <div className={styles.defRow}><dt>預約時間</dt><dd>{selectedOrder.appointmentTime}</dd></div>
              <div className={styles.defRow}><dt>會員／寵物</dt><dd>{selectedOrder.customerLabel}／{selectedOrder.petLabel}</dd></div>
              <div className={styles.defRow}><dt>商品</dt><dd>{selectedOrder.productLabel} × {selectedOrder.quantity}</dd></div>
              <div className={styles.defRow}><dt>類型</dt><dd>{selectedOrder.purchaseMode === 'exchange' ? `換罐 ${formatTwd(99)}／罐` : `首罐 ${formatTwd(129)}／罐`}</dd></div>
              <div className={styles.defRow}><dt>付款</dt><dd>{selectedOrder.paymentMethod} · 已付款 {formatTwd(selectedOrder.paidAmountTwd)}</dd></div>
              <div className={styles.defRow}><dt>庫存</dt><dd>測試門市已保留 {selectedOrder.quantity} 罐</dd></div>
            </dl>

            {stage === 'verify' ? (
              <>
                <div className={styles.refillStageHeader}>
                  <strong>逐罐驗證空罐</strong>
                  <span>已確認 {entries.filter((entry) => entry.verified).length}／{selectedOrder.quantity}</span>
                </div>
                <ol className={styles.refillJarList}>
                  {entries.map((entry, index) => {
                    const hintId = `old-jar-hint-${index}`;
                    const errorId = `old-jar-error-${index}`;
                    return (
                      <li key={index} className={styles.refillJarCard}>
                        <label className={styles.fieldLabel} htmlFor={`preview-old-jar-serial-${index}`}>空罐 {index + 1}</label>
                        <div className={styles.refillJarControls}>
                          <input
                            id={`preview-old-jar-serial-${index}`}
                            className={styles.field}
                            inputMode="numeric"
                            maxLength={8}
                            value={entry.value}
                            disabled={entry.verified}
                            onChange={(event) => updateSerial(index, event.target.value)}
                            placeholder="輸入 8 位瓶底序號"
                            aria-describedby={entry.error ? errorId : hintId}
                          />
                          <PreviewAction tone={PREVIEW_ACTION_TONES.verifyOldJar} disabled={entry.verified} onClick={() => verifySerial(index)}>
                            {entry.verified ? '已確認' : '驗證'}
                          </PreviewAction>
                        </div>
                        <p id={hintId} className={styles.fieldHint}>示意序號：{selectedOrder.expectedOldSerials[index]}</p>
                        {entry.error ? <p id={errorId} className={styles.errorText} role="alert">{entry.error}</p> : null}
                      </li>
                    );
                  })}
                </ol>
                <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} disabled={!allVerified} onClick={() => setStage('confirm')}>
                  前往確認交付
                </PreviewAction>
                <div className={styles.refillExceptionActions}>
                  <span>顧客沒有帶空罐？</span>
                  <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} onClick={() => setStage('held_for_next_visit')}>保留下次領取</PreviewAction>
                  <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} onClick={() => setStage('awaiting_top_up')}>補差額改首罐</PreviewAction>
                </div>
              </>
            ) : null}

            {stage === 'confirm' ? (
              <>
                <div className={styles.confirmCard}>
                  <strong>
                    {selectedOrder.purchaseMode === 'exchange'
                      ? `已收到 ${selectedOrder.quantity} 個空罐，並將 ${selectedOrder.quantity} 罐商品交給 ${selectedOrder.petLabel} 的主人？`
                      : `確認將 ${selectedOrder.quantity} 罐商品交給 ${selectedOrder.petLabel} 的主人？`}
                  </strong>
                  <p>完成後代表商品已交付；門市不再次收款，也不在此處增加點數。</p>
                </div>
                <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={completeDelivery}>確認完成交付（預覽）</PreviewAction>
                {selectedOrder.purchaseMode === 'exchange' ? (
                  <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={() => setStage('verify')}>返回修改序號</PreviewAction>
                ) : null}
              </>
            ) : null}

            {stage === 'held_for_next_visit' ? (
              <div className={styles.confirmCard} role="status">
                <strong>已保留下次領取（預覽）</strong>
                <p>本次不交付、不扣除保留庫存、不改付款；正式系統需由受控流程處理保留期限。</p>
              </div>
            ) : null}

            {stage === 'awaiting_top_up' ? (
              <div className={styles.confirmCard} role="status">
                <strong>等待補差額（預覽）</strong>
                <p>補款成功前不可交付。店員不能現場改成已付款，也不能跳過付款驗證。</p>
              </div>
            ) : null}

            {stage === 'completed' ? (
              <>
                <div className={styles.refillSuccess} role="status">
                  <strong>已交付 ✓</strong>
                  <p>預覽已完成；未扣除正式庫存、未使用真實序號，也沒有增加點數。</p>
                </div>
                <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={openNextOrder}>
                  {nextOrder ? `處理下一筆（${nextOrder.appointmentTime}）` : '返回待換罐'}
                </PreviewAction>
              </>
            ) : null}

            <p className={styles.quietNote}>門市只驗證舊罐並確認交付；新罐由會員領取後在 LINE 登錄，屆時才增加點數。</p>
            {stage !== 'completed' ? (
              <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={closeOrder}>返回待換罐</PreviewAction>
            ) : null}
          </div>
        ) : null}
      </PreviewDialog>
    </section>
  );
}
