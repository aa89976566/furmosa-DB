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

function serialEntries(quantity: number): SerialEntry[] {
  return Array.from({ length: quantity }, () => ({ value: '', verified: false, error: null }));
}

export function RefillPanel() {
  const actionable = useMemo(() => actionableRefillOrders(REFILL_PREVIEW_ORDERS), []);
  const blocked = useMemo(() => blockedRefillOrders(REFILL_PREVIEW_ORDERS), []);
  const [selectedOrder, setSelectedOrder] = useState<RefillPreviewOrder | null>(null);
  const [entries, setEntries] = useState<SerialEntry[]>([]);
  const [stage, setStage] = useState<RefillDeliveryStage>('verify');
  const [completedOrderIds, setCompletedOrderIds] = useState<Set<string>>(new Set());
  const [topUpPaid, setTopUpPaid] = useState(false);
  const [pickupQuantity, setPickupQuantity] = useState(1);
  const [returnedJarQuantity, setReturnedJarQuantity] = useState<number | null>(null);
  const [linePaymentRequested, setLinePaymentRequested] = useState(false);
  const [remainingQuantities, setRemainingQuantities] = useState<Record<string, number>>({});
  const [returnedOldSerials, setReturnedOldSerials] = useState<Set<string>>(new Set());

  function openOrder(order: RefillPreviewOrder) {
    const remainingQuantity = remainingQuantities[order.orderId] ?? order.quantity;
    const effectiveOrder = { ...order, quantity: remainingQuantity };
    setSelectedOrder(effectiveOrder);
    setPickupQuantity(remainingQuantity);
    setReturnedJarQuantity(null);
    setEntries([]);
    setTopUpPaid(false);
    setLinePaymentRequested(false);
    setStage(completedOrderIds.has(order.orderId) ? 'completed' : initialRefillStage(order));
  }

  function changePickupQuantity(quantity: number) {
    setPickupQuantity(quantity);
    setReturnedJarQuantity(null);
    setEntries([]);
    setTopUpPaid(false);
    setLinePaymentRequested(false);
  }

  function changeReturnedJarQuantity(quantity: number) {
    setReturnedJarQuantity(quantity);
    setEntries(serialEntries(quantity));
    setTopUpPaid(false);
    setLinePaymentRequested(false);
    if (quantity === 0) setStage('awaiting_top_up');
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
      if (returnedOldSerials.has(parsed.value)) {
        return current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, verified: false, error: '這個空罐已經退回過，不能重複使用' }
            : item,
        );
      }
      if (!selectedOrder.expectedOldSerials.includes(parsed.value)) {
        return current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, verified: false, error: '這不是這位會員可使用的空罐' }
            : item,
        );
      }
      return current.map((item, itemIndex) =>
        itemIndex === index ? { value: parsed.value, verified: true, error: null } : item,
      );
    });
  }

  function completeDelivery() {
    if (!selectedOrder || !canConfirmRefillDelivery(selectedOrder, entries.map((entry) => entry.verified), topUpPaid, pickupQuantity)) return;
    const remaining = selectedOrder.quantity - pickupQuantity;
    setReturnedOldSerials((current) => {
      const next = new Set(current);
      entries.filter((entry) => entry.verified).forEach((entry) => next.add(entry.value));
      return next;
    });
    if (remaining > 0) {
      setRemainingQuantities((current) => ({ ...current, [selectedOrder.orderId]: remaining }));
    } else {
      setCompletedOrderIds((current) => new Set(current).add(selectedOrder.orderId));
    }
    setStage('completed');
  }

  function openNextOrder() {
    if (!selectedOrder) return;
    const next = nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, selectedOrder.orderId, completedOrderIds);
    if (next) openOrder(next);
    else closeOrder();
  }

  const verifiedCount = entries.filter((entry) => entry.verified).length;
  const pricing = selectedOrder ? refillPriceBreakdown(selectedOrder, verifiedCount, pickupQuantity) : null;
  const readyToConfirm = selectedOrder
    ? canConfirmRefillDelivery(selectedOrder, entries.map((entry) => entry.verified), false, pickupQuantity)
    : false;
  const nextOrder = selectedOrder
    ? nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, selectedOrder.orderId, completedOrderIds)
    : null;
  const pendingOrders = actionable
    .filter((order) => !completedOrderIds.has(order.orderId))
    .map((order) => ({ ...order, quantity: remainingQuantities[order.orderId] ?? order.quantity }))
    .filter((order) => order.quantity > 0);
  const remainingAfterDelivery = selectedOrder ? Math.max(0, selectedOrder.quantity - pickupQuantity) : 0;

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
              <div className={styles.defRow}><dt>顧客</dt><dd>{selectedOrder.petLabel} 的家人</dd></div>
              <div className={styles.defRow}><dt>商品</dt><dd>{selectedOrder.productLabel}</dd></div>
              <div className={styles.defRow}><dt>尚可領取</dt><dd>{selectedOrder.quantity} 罐</dd></div>
            </dl>

            {stage === 'verify' ? (
              <>
                <div className={styles.refillStageHeader}>
                  <strong>1. 本次領取幾罐？</strong>
                  <span>尚可領取 {selectedOrder.quantity} 罐</span>
                </div>
                <div className={styles.refillExceptionActions} aria-label="本次領取數量">
                  {Array.from({ length: selectedOrder.quantity }, (_, index) => index + 1).map((quantity) => (
                    <PreviewAction
                      key={quantity}
                      tone={quantity === pickupQuantity ? PREVIEW_ACTION_TONES.completeRefill : PREVIEW_ACTION_TONES.refundCancel}
                      onClick={() => changePickupQuantity(quantity)}
                    >
                      領取 {quantity} 罐
                    </PreviewAction>
                  ))}
                </div>
                <div className={styles.refillStageHeader}>
                  <strong>2. 本次歸還幾個空罐？</strong>
                  <span>{returnedJarQuantity === null ? '尚未選擇' : `已選 ${returnedJarQuantity} 個`}</span>
                </div>
                <div className={styles.refillExceptionActions} aria-label="帶來的空罐數量">
                  {Array.from({ length: pickupQuantity + 1 }, (_, index) => index).map((quantity) => (
                    <PreviewAction
                      key={quantity}
                      tone={quantity === returnedJarQuantity ? PREVIEW_ACTION_TONES.completeRefill : PREVIEW_ACTION_TONES.refundCancel}
                      onClick={() => changeReturnedJarQuantity(quantity)}
                    >
                      {quantity === 0 ? '沒有歸還' : `歸還 ${quantity} 個`}
                    </PreviewAction>
                  ))}
                </div>
                {returnedJarQuantity ? <p className={styles.hint}>請輸入每個空罐底下的 8 位數字。</p> : null}
                <ol className={styles.refillJarList}>
                  {entries.map((entry, index) => {
                    const hintId = `old-jar-hint-${index}`;
                    const errorId = `old-jar-error-${index}`;
                    return (
                      <li key={index} className={styles.refillJarCard}>
                        <label className={styles.fieldLabel} htmlFor={`preview-old-jar-serial-${index}`}>第 {index + 1} 個空罐</label>
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
                            {entry.verified ? '已確認' : '確認這個空罐'}
                          </PreviewAction>
                        </div>
                        <p id={hintId} className={styles.fieldHint}>示意序號：{selectedOrder.expectedOldSerials[index]}</p>
                        {entry.error ? <p id={errorId} className={styles.errorText} role="alert">{entry.error}</p> : null}
                      </li>
                    );
                  })}
                </ol>
                {returnedJarQuantity !== null && returnedJarQuantity > 0 && verifiedCount === returnedJarQuantity && readyToConfirm ? (
                  <>
                    <div className={styles.refillDecisionCard} role="status">
                      <strong>不用再付錢</strong>
                      <span>今天拿 {pickupQuantity} 罐，也帶了 {pickupQuantity} 個空罐。</span>
                    </div>
                    <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={() => setStage('confirm')}>
                      交給客人 {pickupQuantity} 罐
                    </PreviewAction>
                  </>
                ) : returnedJarQuantity !== null && returnedJarQuantity > 0 && verifiedCount === returnedJarQuantity ? (
                  <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={() => setStage('awaiting_top_up')}>
                    看結果
                  </PreviewAction>
                ) : null}
                <div className={styles.refillExceptionActions}>
                  <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} onClick={() => setStage('held_for_next_visit')}>今天先不領</PreviewAction>
                </div>
              </>
            ) : null}

            {stage === 'confirm' ? (
              <>
                <div className={styles.confirmCard}>
                  <dl className={styles.refillConfirmList}>
                    <div><dt>本次交付</dt><dd>{pickupQuantity} 罐</dd></div>
                    <div><dt>下次可領</dt><dd>{selectedOrder.quantity - pickupQuantity} 罐</dd></div>
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
                <strong>本次未領取（預覽）</strong>
                <p>商品仍保留在這筆訂單中，今天不交付，也不變更付款狀態。</p>
              </div>
            ) : null}

            {stage === 'awaiting_top_up' ? (
              <>
                <div className={styles.refillDecisionCard} role="status">
                  <strong>需要在線上補 {formatTwd(pricing?.topUpAmountTwd ?? 0)}</strong>
                  <span>請客人到官方 LINE 付款。付款成功前，先不要交付商品。</span>
                </div>
                <details className={styles.disclosure}>
                  <summary className={styles.disclosureSummary}>查看計價明細</summary>
                  <div className={styles.disclosureBody}>
                    <dl className={styles.refillConfirmList}>
                      <div><dt>本次領取</dt><dd>{pickupQuantity} 罐</dd></div>
                      <div><dt>已收到空罐</dt><dd>{verifiedCount} 個</dd></div>
                      <div><dt>未提供空罐</dt><dd>{pricing?.originalPriceQuantity ?? 0} 個</dd></div>
                      <div><dt>每缺 1 個空罐</dt><dd>補款 {formatTwd(30)}</dd></div>
                      <div><dt>本次補款</dt><dd>{formatTwd(pricing?.topUpAmountTwd ?? 0)}</dd></div>
                    </dl>
                  </div>
                </details>
                {!linePaymentRequested ? (
                  <PreviewAction
                    tone={PREVIEW_ACTION_TONES.completeRefill}
                    className={styles.actionBlock}
                    onClick={() => setLinePaymentRequested(true)}
                  >
                    請客人到官方 LINE 付款
                  </PreviewAction>
                ) : (
                  <>
                    <div className={styles.notice} role="status">
                      等待官方 LINE 回傳付款成功。收到通知前不能交付商品。
                    </div>
                    <PreviewAction
                      tone={PREVIEW_ACTION_TONES.completeRefill}
                      className={styles.actionBlock}
                      onClick={() => { setTopUpPaid(true); setStage('confirm'); }}
                    >
                      模擬收到 LINE 付款成功（預覽）
                    </PreviewAction>
                  </>
                )}
                <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={() => setStage('verify')}>
                  回去重選
                </PreviewAction>
              </>
            ) : null}

            {stage === 'completed' ? (
              <>
                <div className={styles.refillSuccess} role="status">
                  <strong>{remainingAfterDelivery > 0 ? '本次領取完成 ✓' : '已完成換罐 ✓'}</strong>
                  <p>{remainingAfterDelivery > 0 ? `還有 ${remainingAfterDelivery} 罐保留下次領取，訂單會繼續留在待換罐清單。` : '這張訂單已全部領取完成。'}</p>
                </div>
                <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={remainingAfterDelivery > 0 ? closeOrder : openNextOrder}>
                  {remainingAfterDelivery > 0 ? '返回待換罐清單' : nextOrder ? `處理下一筆（${nextOrder.appointmentTime}）` : '返回待換罐清單'}
                </PreviewAction>
              </>
            ) : null}

            <p className={styles.quietNote}>
              {selectedOrder.purchaseMode === 'exchange'
                ? '此頁只確認本次交付與空罐回收。新罐點數會在顧客透過官方 LINE 完成登記後入帳。'
                : '首罐不需歸還空罐。新罐點數會在顧客透過官方 LINE 完成登記後入帳。'}
            </p>
            {stage !== 'completed' ? (
              <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={closeOrder}>返回待換罐清單</PreviewAction>
            ) : null}
          </div>
        ) : null}
      </PreviewDialog>
    </section>
  );
}
