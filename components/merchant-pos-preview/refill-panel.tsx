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
  refillPriceBreakdown,
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
  const [topUpPaid, setTopUpPaid] = useState(false);

  function openOrder(order: RefillPreviewOrder) {
    setSelectedOrder(order);
    setEntries(serialEntries(order));
    setTopUpPaid(false);
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
    if (!selectedOrder || !canConfirmRefillDelivery(selectedOrder, entries.map((entry) => entry.verified), topUpPaid)) return;
    setCompletedOrderIds((current) => new Set(current).add(selectedOrder.orderId));
    setStage('completed');
  }

  function openNextOrder() {
    if (!selectedOrder) return;
    const next = nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, selectedOrder.orderId, completedOrderIds);
    if (next) openOrder(next);
    else closeOrder();
  }

  const verifiedCount = entries.filter((entry) => entry.verified).length;
  const pricing = selectedOrder ? refillPriceBreakdown(selectedOrder, verifiedCount) : null;
  const readyToConfirm = selectedOrder
    ? canConfirmRefillDelivery(selectedOrder, entries.map((entry) => entry.verified))
    : false;
  const nextOrder = selectedOrder
    ? nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, selectedOrder.orderId, completedOrderIds)
    : null;
  const pendingOrders = actionable.filter((order) => !completedOrderIds.has(order.orderId));

  return (
    <section aria-labelledby="refill-title" className="min-w-0 space-y-6">
      <div className={styles.pageHeader}>
        <h2 id="refill-title" className={styles.sectionTitle}>{REFILL_TITLE}</h2>
        <p className={styles.sectionIntro}>{REFILL_INTRO}</p>
      </div>

      <div className={styles.refillQueueSummary} aria-label="待換罐摘要">
        <span><strong>{pendingOrders.length}</strong> 筆可處理</span>
        {completedOrderIds.size > 0 ? <span>本次已完成 {completedOrderIds.size} 筆</span> : null}
        <span>{blocked.length} 筆付款或庫存尚未完成</span>
      </div>

      {pendingOrders.length > 0 ? (
        <ul className={styles.recordList}>
          {pendingOrders.map((order) => (
            <li key={order.orderId} className={styles.recordListItem}>
              <button type="button" className={styles.recordRowButton} onClick={() => openOrder(order)}>
                <span className={styles.recordMain}>
                  <strong>{order.appointmentTime} · {order.petLabel}</strong>
                  <span>{order.productLabel} × {order.quantity}</span>
                  <span>{order.purchaseMode === 'exchange' ? `換罐 · 需收回 ${order.quantity} 個空罐` : '首罐 · 不需回收空罐'}</span>
                </span>
                <span className={styles.recordSummary}>
                  <strong>{order.arrived ? '已到店' : '已付款'}</strong>
                  <span>已保留門市庫存</span>
                </span>
                <span className={styles.recordChevron} aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className={styles.notice}>目前沒有待交付的首罐或換罐訂單。</p>}

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
        title={stage === 'completed' ? '換罐完成' : stage === 'confirm' ? '確認商品已交付？' : '辦理換罐'}
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
              <div className={styles.defRow}><dt>訂單狀態</dt><dd>訂單已付款</dd></div>
              <div className={styles.defRow}><dt>取貨方式</dt><dd>門市取貨 · 已保留 {selectedOrder.quantity} 罐</dd></div>
            </dl>

            {stage === 'verify' ? (
              <>
                <div className={styles.refillStageHeader}>
                  <strong>1. 確認空罐</strong>
                  <span>已確認 {verifiedCount}／{selectedOrder.quantity}</span>
                </div>
                <p className={styles.hint}>本筆訂單需要 {selectedOrder.quantity} 個有效空罐，請逐一輸入瓶底序號。</p>
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
                {readyToConfirm ? (
                  <>
                    <div className={styles.refillDecisionCard} role="status">
                      <strong>空罐數量已確認</strong>
                      <span>已收到 {selectedOrder.quantity} 個空罐，本次不需補款。</span>
                    </div>
                    <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={() => setStage('confirm')}>
                      確認交付 {selectedOrder.quantity} 罐
                    </PreviewAction>
                  </>
                ) : (
                  <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={() => setStage('awaiting_top_up')}>
                    沒有其他空罐
                  </PreviewAction>
                )}
                <div className={styles.refillExceptionActions}>
                  <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} onClick={() => setStage('held_for_next_visit')}>稍後取貨</PreviewAction>
                </div>
              </>
            ) : null}

            {stage === 'confirm' ? (
              <>
                <div className={styles.confirmCard}>
                  <dl className={styles.refillConfirmList}>
                    <div><dt>交付數量</dt><dd>{selectedOrder.quantity} 罐</dd></div>
                    <div><dt>收到空罐</dt><dd>{verifiedCount} 個</dd></div>
                    <div><dt>補款</dt><dd>{pricing?.topUpAmountTwd ? `${formatTwd(pricing.topUpAmountTwd)}（已收款）` : '不需補款'}</dd></div>
                  </dl>
                </div>
                <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={completeDelivery}>完成換罐（預覽）</PreviewAction>
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
              <>
                <div className={styles.refillDecisionCard} role="status">
                  <strong>尚缺 {pricing?.originalPriceQuantity ?? 0} 個空罐</strong>
                  <span>需補款 {formatTwd(pricing?.topUpAmountTwd ?? 0)}，完成收款後才能交付商品。</span>
                </div>
                <details className={styles.disclosure}>
                  <summary className={styles.disclosureSummary}>查看計價明細</summary>
                  <div className={styles.disclosureBody}>
                    <dl className={styles.refillConfirmList}>
                      <div><dt>預訂數量</dt><dd>{selectedOrder.quantity} 罐</dd></div>
                      <div><dt>已收到空罐</dt><dd>{verifiedCount} 個</dd></div>
                      <div><dt>未提供空罐</dt><dd>{pricing?.originalPriceQuantity ?? 0} 個</dd></div>
                      <div><dt>每缺 1 個空罐</dt><dd>補款 {formatTwd(30)}</dd></div>
                      <div><dt>本次補款</dt><dd>{formatTwd(pricing?.topUpAmountTwd ?? 0)}</dd></div>
                    </dl>
                  </div>
                </details>
                <PreviewAction
                  tone={PREVIEW_ACTION_TONES.completeRefill}
                  className={styles.actionBlock}
                  onClick={() => { setTopUpPaid(true); setStage('confirm'); }}
                >
                  收取 {formatTwd(pricing?.topUpAmountTwd ?? 0)}（預覽）
                </PreviewAction>
                <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={() => setStage('verify')}>
                  返回確認空罐
                </PreviewAction>
              </>
            ) : null}

            {stage === 'completed' ? (
              <>
                <div className={styles.refillSuccess} role="status">
                  <strong>已完成換罐 ✓</strong>
                  <p>預覽已完成；未扣除正式庫存、未使用真實序號，也沒有增加點數。</p>
                </div>
                <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={openNextOrder}>
                  {nextOrder ? `處理下一筆（${nextOrder.appointmentTime}）` : '返回待換罐'}
                </PreviewAction>
              </>
            ) : null}

            <p className={styles.quietNote}>
              {selectedOrder.purchaseMode === 'exchange'
                ? '門市只驗證舊罐並確認交付；新罐由會員領取後在 LINE 登錄，屆時才增加點數。'
                : '首罐不需要驗證舊罐；會員領取後在 LINE 登錄新罐，屆時才增加點數。'}
            </p>
            {stage !== 'completed' ? (
              <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={closeOrder}>返回待換罐</PreviewAction>
            ) : null}
          </div>
        ) : null}
      </PreviewDialog>
    </section>
  );
}
