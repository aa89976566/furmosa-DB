'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Info } from 'lucide-react';
import { JarSerialPanel } from '@/components/pos/jar-serial-panel';
import { mapRefillStaffError } from '@/lib/pos/refill-staff-errors';
import {
  formatRefillDateTime,
  refillCompleteBlockedReason,
  refillKindLabel,
  refillPaymentStaffCopy,
  refillStaffView,
  type PosRefillOrderCard,
} from '@/lib/pos/refill-view';

type RetryKind = 'old' | 'new' | 'complete' | 'missing';

export function RefillOrderPanel({
  order,
  payQrUrl,
  prefillOldSerial = '',
  busy,
  onBusy,
  onClose,
  onOrderPatch,
  onCompleted,
  onToast,
}: {
  order: PosRefillOrderCard;
  payQrUrl: string | null;
  prefillOldSerial?: string;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onClose: () => void;
  onOrderPatch: (patch: Partial<PosRefillOrderCard>) => void;
  onCompleted: (payload: { newSerial: string; customerName: string; amount: number }) => void;
  onToast: (text: string) => void;
}) {
  const view = refillStaffView(order);
  const payment = refillPaymentStaffCopy(order);
  const headingId = useId();
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [pendingOld, setPendingOld] = useState('');
  const [pendingNew, setPendingNew] = useState('');
  const [newConfirmed, setNewConfirmed] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryKind | null>(null);
  const [activeAction, setActiveAction] = useState<RetryKind | null>(null);

  useEffect(() => {
    setPendingOld(prefillOldSerial || order.oldContainerSerial || '');
    setPendingNew(order.newContainerSerial || '');
    setNewConfirmed(Boolean(order.newContainerSerial));
    setMissingOpen(false);
    setLeaveConfirm(false);
    setError(null);
    setRetryAction(null);
    headingRef.current?.focus();
  }, [order.id, prefillOldSerial]);

  const oldDone = view.skipOldJar || order.status === 'old_container_verified';
  const oldReady = oldDone;
  const completeBlocked = refillCompleteBlockedReason({
    unpaidBlock: view.unpaidBlock,
    oldReady,
    hasNewSerial: Boolean(pendingNew),
    newConfirmed,
  });
  const dirty = Boolean((pendingOld && !oldDone) || (pendingNew && !newConfirmed));
  const kindLabel = refillKindLabel(order);
  const submitting = busy || activeAction != null;

  async function post(
    path: string,
    body: Record<string, unknown>,
    context: RetryKind,
  ) {
    onBusy(true);
    setActiveAction(context);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        const staffError = mapRefillStaffError(
          data,
          context === 'complete' ? 'complete' : context,
        );
        setError(staffError);
        if (staffError.includes('新罐')) setRetryAction('new');
        else setRetryAction(context);
        return null;
      }
      return data;
    } catch {
      setError('連線暫時有問題，請再試一次。還沒有完成換罐。');
      setRetryAction(context);
      return null;
    } finally {
      setActiveAction(null);
      onBusy(false);
    }
  }

  function takeOldSerial(serial: string) {
    if (pendingOld && serial === pendingOld) {
      setError('這個罐子已經掃過。');
      return;
    }
    setError(null);
    setPendingOld(serial);
  }

  function takeNewSerial(serial: string) {
    if (pendingNew && serial === pendingNew) {
      setError('這個罐子已經掃過。');
      return;
    }
    if (serial === pendingOld || serial === (order.oldContainerSerial ?? '')) {
      setError('這個新罐目前不能交付。');
      setRetryAction('new');
      setPendingNew('');
      setNewConfirmed(false);
      return;
    }
    setError(null);
    setRetryAction(null);
    setPendingNew(serial);
    setNewConfirmed(false);
  }

  async function confirmOld() {
    const result = await post(
      `/api/merchant/refill-orders/${order.id}/verify-old-container`,
      { serial: pendingOld },
      'old',
    );
    if (!result) return;
    setRetryAction(null);
    onOrderPatch({
      status: 'old_container_verified',
      oldContainerSerial: pendingOld,
      oldContainerReturnedAt: new Date().toISOString(),
    });
  }

  async function completeRefill() {
    if (completeBlocked) {
      setError(completeBlocked);
      return;
    }
    const result = await post(
      `/api/merchant/refill-orders/${order.id}/complete`,
      { newSerial: pendingNew },
      'complete',
    );
    if (!result) return;
    onCompleted({
      newSerial: pendingNew,
      customerName: order.customerName,
      amount: order.totalAmount,
    });
  }

  async function missing(choice: 'keep' | 'topup') {
    const result = await post(
      `/api/merchant/refill-orders/${order.id}/mark-missing-container`,
      { choice },
      'missing',
    );
    if (!result) return;
    if (choice === 'keep') {
      onOrderPatch({ missingContainerNote: '顧客未帶空罐' });
      setMissingOpen(false);
      onToast('已留下這筆訂單，請客人下次帶空罐再領。');
      return;
    }
    onOrderPatch({
      status: 'awaiting_extra_payment',
      missingContainerNote: '顧客未帶空罐，改補差額',
      paid: order.paid,
    });
    setMissingOpen(false);
  }

  function requestClose() {
    if (dirty && !leaveConfirm) {
      setLeaveConfirm(true);
      return;
    }
    onClose();
  }

  function retry() {
    setError(null);
    if (retryAction === 'old') setPendingOld('');
    if (retryAction === 'new') {
      setPendingNew('');
      setNewConfirmed(false);
    }
    setRetryAction(null);
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="text-xl font-semibold text-zinc-900 outline-none"
          >
            {order.customerName}
          </h2>
          <p className="mt-1 break-words text-base text-zinc-500">
            {kindLabel}
            {order.petName ? ` · ${order.petName}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl px-3 text-base font-medium text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          onClick={requestClose}
        >
          返回找客人
        </button>
      </div>

      {leaveConfirm ? (
        <div className="mt-4 rounded-2xl border border-zinc-900 bg-white p-4" role="alertdialog" aria-labelledby={`${headingId}-leave`}>
          <p id={`${headingId}-leave`} className="font-semibold text-zinc-900">
            返回會清除還沒確認的罐號
          </p>
          <p className="mt-1 text-base text-zinc-600">
            已經確認過的空罐不會取消。還沒按下確認的空罐或新罐會清掉。
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="flex min-h-12 items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white"
              onClick={onClose}
            >
              仍要返回找客人
            </button>
            <button
              type="button"
              className="flex min-h-12 items-center justify-center rounded-xl border border-zinc-900 text-base font-semibold"
              onClick={() => setLeaveConfirm(false)}
            >
              繼續這筆換罐
            </button>
          </div>
        </div>
      ) : null}

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-500">客人資料</h3>
        <dl className="mt-3 space-y-2 text-base">
          <SummaryRow label="客人" value={order.customerName} />
          {order.petName ? <SummaryRow label="寵物" value={order.petName} /> : null}
          <SummaryRow label="類型" value={kindLabel} />
          <SummaryRow
            label="目前狀態"
            value={
              view.unpaidBlock
                ? payment.title
                : oldDone
                  ? pendingNew && newConfirmed
                    ? '可以確認完成換罐'
                    : '可以選擇新罐'
                  : '等待確認空罐'
            }
          />
        </dl>
      </section>

      <section
        className={`mt-4 rounded-2xl border p-4 ${
          payment.kind === 'online_paid'
            ? 'border-neutral-200 bg-neutral-50'
            : 'border-amber-300 bg-amber-50'
        }`}
      >
        <h3 className="text-lg font-semibold text-zinc-900">{payment.title}</h3>
        <p className="mt-1 break-words text-base text-zinc-700">{payment.detail}</p>
        <p className="mt-2 text-base font-medium text-zinc-900">{payment.staffNeed}</p>
        {view.extraPaid ? (
          <p className="mt-2 text-base text-zinc-700">補差額已付完，可以直接交給新罐。</p>
        ) : null}
        {view.unpaidBlock && order.status === 'awaiting_extra_payment' && payQrUrl ? (
          <a
            href={payQrUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-zinc-900 bg-white text-base font-semibold"
          >
            請客人線上補差額
          </a>
        ) : null}
      </section>

      {view.unpaidBlock ? null : (
        <div className="mt-6 space-y-6">
          <section>
            <StageHeading
              label="確認空罐"
              state={oldDone ? 'done' : 'current'}
            />
            {oldDone ? (
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-sm text-zinc-500">空罐</p>
                <p className="mt-1 break-all text-lg font-semibold tracking-wide">
                  {view.skipOldJar ? '這筆是首罐，不用回收空罐' : order.oldContainerSerial ?? pendingOld}
                </p>
                {order.oldContainerReturnedAt ? (
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatRefillDateTime(order.oldContainerReturnedAt)} 已確認
                  </p>
                ) : null}
              </div>
            ) : pendingOld ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">即將確認的空罐</p>
                <p className="break-all text-2xl font-semibold tracking-wide">{pendingOld}</p>
                <p className="text-base text-zinc-600">按下後會記下這顆空罐。請確認這是客人帶來的罐子。</p>
                <button
                  type="button"
                  disabled={submitting}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:opacity-60"
                  onClick={() => void confirmOld()}
                >
                  {activeAction === 'old' ? '正在確認空罐…' : '確認空罐'}
                </button>
                <button
                  type="button"
                  className="w-full min-h-11 text-base text-zinc-600"
                  onClick={() => {
                    setPendingOld('');
                    setError(null);
                    setRetryAction(null);
                  }}
                >
                  重新掃描空罐
                </button>
              </div>
            ) : (
              <JarSerialPanel
                variant="tile"
                inputId="refill-old-jar"
                primaryLabel="掃描空罐"
                primaryHint="掃描客人帶來的空罐底部"
                secondaryLabel="手動輸入空罐序號"
                submitLabel="確認空罐編號"
                busyLabel="處理中…"
                busy={submitting}
                onSerial={takeOldSerial}
              />
            )}
          </section>

          <section>
            <StageHeading
              label="選擇新罐"
              state={oldDone ? (newConfirmed && pendingNew ? 'done' : 'current') : 'upcoming'}
            />
            {!oldDone ? (
              <p className="text-base text-zinc-500">請先確認空罐，才能選擇新罐。</p>
            ) : newConfirmed && pendingNew ? (
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-sm text-zinc-500">新罐</p>
                <p className="mt-1 break-all text-lg font-semibold tracking-wide">{pendingNew}</p>
                <button
                  type="button"
                  className="mt-2 text-base text-zinc-600 underline"
                  onClick={() => {
                    setNewConfirmed(false);
                    setPendingNew('');
                  }}
                >
                  改選其他新罐
                </button>
              </div>
            ) : pendingNew ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">即將交給客人的新罐</p>
                <p className="break-all text-2xl font-semibold tracking-wide">{pendingNew}</p>
                <button
                  type="button"
                  disabled={submitting}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:opacity-60"
                  onClick={() => setNewConfirmed(true)}
                >
                  確認選擇這個新罐
                </button>
                <button
                  type="button"
                  className="w-full min-h-11 text-base text-zinc-600"
                  onClick={() => {
                    setPendingNew('');
                    setNewConfirmed(false);
                    setError(null);
                  }}
                >
                  重新掃描新罐
                </button>
              </div>
            ) : (
              <JarSerialPanel
                variant="tile"
                inputId="refill-new-jar"
                primaryLabel="掃描新罐"
                primaryHint="掃描要交給客人的新罐"
                secondaryLabel="手動輸入新罐序號"
                submitLabel="確認新罐編號"
                busyLabel="處理中…"
                busy={submitting}
                onSerial={takeNewSerial}
              />
            )}
          </section>

          <section>
            <StageHeading label="確認完成" state={completeBlocked ? 'upcoming' : 'current'} />
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h3 className="text-base font-semibold text-zinc-900">送出前請再看一次</h3>
              <dl className="mt-3 space-y-2">
                <SummaryRow label="客人" value={order.customerName} />
                <SummaryRow
                  label="空罐"
                  value={view.skipOldJar ? '首罐，不用回收' : pendingOld || '尚未確認'}
                />
                <SummaryRow label="新罐" value={pendingNew || '尚未選擇'} />
                <SummaryRow label="金額" value={`NT$${order.totalAmount}`} />
                <SummaryRow label="付款" value={payment.title} />
              </dl>
              <p className="mt-3 text-base text-zinc-600">
                按下後會完成這筆換罐：空罐入庫、新罐交給客人。這一步不能在畫面裡反悔。
              </p>
              <button
                type="button"
                disabled={submitting || Boolean(completeBlocked)}
                aria-describedby={completeBlocked || error ? errorId : undefined}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:bg-neutral-200 disabled:text-zinc-500"
                onClick={() => void completeRefill()}
              >
                {activeAction === 'complete' ? '正在完成換罐…' : '確認完成換罐'}
              </button>
              {completeBlocked ? (
                <p id={errorId} className="mt-2 text-base text-zinc-600">
                  {completeBlocked}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {error ? (
        <div className="mt-4 space-y-2" role="alert">
          <p id={errorId} className="break-words text-base text-zinc-800">
            {error}
          </p>
          {retryAction === 'old' || retryAction === 'new' ? (
            <button type="button" className="text-base text-zinc-700 underline" onClick={retry}>
              {retryAction === 'old' ? '重新掃描空罐' : '重新掃描新罐'}
            </button>
          ) : retryAction === 'complete' || retryAction === 'missing' ? (
            <p className="text-base text-zinc-600">資料還在，可以直接再試一次。如果一直失敗，請聯絡匠寵。</p>
          ) : (
            <p className="text-base text-zinc-600">如果仍失敗，請聯絡匠寵。</p>
          )}
        </div>
      ) : null}

      {!view.unpaidBlock && !oldDone && !view.skipOldJar ? (
        <div className="mt-6 rounded-2xl bg-neutral-50 px-4 py-3">
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left"
            onClick={() => setMissingOpen((open) => !open)}
            aria-expanded={missingOpen}
          >
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
            <span className="flex-1">
              <span className="flex items-center justify-between text-base font-medium text-zinc-800">
                客人忘記帶空罐？
                <ChevronDown className={`h-4 w-4 text-zinc-400 ${missingOpen ? 'rotate-180' : ''}`} aria-hidden />
              </span>
              <span className="mt-1 block text-base text-zinc-500">
                請客人先在線上補差額，或下次帶空罐再領。店內不能代收現金。
              </span>
            </span>
          </button>
          {missingOpen ? (
            <div className="space-y-3 pt-3">
              <p className="text-base text-zinc-600">不能略過空罐直接把新罐拿走。</p>
              <button
                type="button"
                disabled={submitting}
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 bg-white text-base font-semibold disabled:opacity-60"
                onClick={() => void missing('topup')}
              >
                {activeAction === 'missing' ? '處理中…' : '請客人線上補差額'}
              </button>
              <button
                type="button"
                disabled={submitting}
                className="flex min-h-12 w-full items-center justify-center rounded-xl text-base font-medium text-zinc-700 disabled:opacity-60"
                onClick={() => void missing('keep')}
              >
                留下訂單，下次帶空罐再領
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RefillSuccessPanel({
  customerName,
  newSerial,
  amount,
  onDone,
}: {
  customerName: string;
  newSerial: string;
  amount?: number;
  onDone: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <p className="text-sm font-medium text-zinc-500">換罐完成</p>
      <h2 className="mt-1 text-2xl font-semibold text-zinc-900">已經交給 {customerName}</h2>
      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-sm text-zinc-500">新罐</p>
        <p className="mt-1 break-all text-2xl font-semibold tracking-wide">{newSerial}</p>
        {amount != null ? (
          <>
            <p className="mt-4 text-sm text-zinc-500">金額</p>
            <p className="mt-1 text-lg font-semibold">NT${amount}</p>
          </>
        ) : null}
      </div>
      <button
        type="button"
        className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white"
        onClick={onDone}
      >
        處理下一位客人
      </button>
      <Link
        href="/pos/records"
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 text-base font-semibold"
      >
        查看紀錄
      </Link>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function StageHeading({
  label,
  state,
}: {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}) {
  const stateLabel = state === 'done' ? '已完成' : state === 'current' ? '目前' : '尚未開始';
  return (
    <div className="mb-3">
      <p className="text-sm text-zinc-500">{stateLabel}</p>
      <h3 className="text-lg font-semibold text-zinc-900">{label}</h3>
    </div>
  );
}
