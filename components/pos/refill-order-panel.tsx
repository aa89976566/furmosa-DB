'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { JarSerialPanel } from '@/components/pos/jar-serial-panel';
import { mapRefillStaffError } from '@/lib/pos/refill-staff-errors';
import { refillStaffView, type PosRefillOrderCard } from '@/lib/pos/refill-view';

type Step = 1 | 2 | 3;

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
  onCompleted: (payload: { newSerial: string; customerName: string }) => void;
  onToast: (text: string) => void;
}) {
  const view = refillStaffView(order);
  const [pendingOld, setPendingOld] = useState('');
  const [pendingNew, setPendingNew] = useState('');
  const [newConfirmed, setNewConfirmed] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<'old' | 'new' | null>(null);

  useEffect(() => {
    setPendingOld(prefillOldSerial || order.oldContainerSerial || '');
    setPendingNew(order.newContainerSerial || '');
    setNewConfirmed(false);
    setMissingOpen(false);
    setError(null);
    setRetryAction(null);
  }, [order.id, order.oldContainerSerial, order.newContainerSerial, prefillOldSerial]);

  const oldDone = view.skipOldJar || order.status === 'old_container_verified';
  const newReady = oldDone && Boolean(pendingNew) && newConfirmed;
  const currentStep: Step = view.unpaidBlock ? 1 : !oldDone ? 1 : !newReady ? 2 : 3;

  async function post(
    path: string,
    body: Record<string, unknown>,
    context: 'old' | 'new' | 'complete' | 'missing',
  ) {
    onBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setError(mapRefillStaffError(data, context));
        return null;
      }
      return data;
    } catch {
      setError('這筆換罐目前不能完成，請重新整理後再試一次');
      return null;
    } finally {
      onBusy(false);
    }
  }

  function takeOldSerial(serial: string) {
    if (pendingOld && serial === pendingOld) {
      setError('這個罐子已經掃過');
      return;
    }
    setError(null);
    setPendingOld(serial);
  }

  function takeNewSerial(serial: string) {
    if (pendingNew && serial === pendingNew) {
      setError('這個罐子已經掃過');
      return;
    }
    if (serial === pendingOld || serial === (order.oldContainerSerial ?? '')) {
      setError('這個新罐目前不能交付');
      setRetryAction('new');
      setPendingNew('');
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
    if (!result) {
      setRetryAction('old');
      return;
    }
    setRetryAction(null);
    onOrderPatch({
      status: 'old_container_verified',
      oldContainerSerial: pendingOld,
    });
  }

  async function completeRefill() {
    const result = await post(
      `/api/merchant/refill-orders/${order.id}/complete`,
      { newSerial: pendingNew },
      'new',
    );
    if (!result) {
      setRetryAction('new');
      return;
    }
    onCompleted({ newSerial: pendingNew, customerName: order.customerName });
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
      onToast('已保留訂單，下次帶空罐再領');
      return;
    }
    onOrderPatch({
      status: 'awaiting_extra_payment',
      missingContainerNote: '顧客未帶空罐，改補差額',
      paid: order.paid,
    });
    setMissingOpen(false);
  }

  if (view.unpaidBlock) {
    return (
      <PanelShell title="訂單詳情" onClose={onClose}>
        <p className="text-lg font-semibold">{order.customerName}</p>
        <p className="mt-1 text-sm text-zinc-500">訂單 {view.orderNo}</p>
        <div className="mt-6 rounded-2xl bg-neutral-50 px-4 py-5">
          <p className="font-semibold text-zinc-900">尚未完成付款</p>
          <p className="mt-1 text-sm text-zinc-600">目前無法換罐</p>
        </div>
        {order.status === 'awaiting_extra_payment' && payQrUrl ? (
          <a
            href={payQrUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-900 text-sm font-semibold"
          >
            請客人線上補 NT$30
          </a>
        ) : null}
      </PanelShell>
    );
  }

  return (
    <PanelShell title="訂單詳情" onClose={onClose}>
      <p className="text-lg font-semibold">{order.customerName}</p>
      <p className="mt-1 text-sm text-zinc-500">訂單 {view.orderNo}</p>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {view.paymentLabel}
        </span>
      </div>
      <p className="mt-3 text-sm text-zinc-700">
        換罐費 NT${order.totalAmount} 已由客人線上付款
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-900">店內不用收款</p>
      {view.extraPaid ? (
        <p className="mt-2 text-sm text-zinc-600">已補差額，可直接交付新罐</p>
      ) : null}

      <ol className="mt-6 space-y-5">
        <StepBlock
          n={1}
          title="驗舊罐"
          state={oldDone ? 'done' : currentStep === 1 ? 'active' : 'locked'}
        >
          {oldDone ? (
            <p className="text-sm text-zinc-600">
              {view.skipOldJar
                ? '這筆不用回收空罐'
                : `舊罐 ${order.oldContainerSerial ?? pendingOld}`}
            </p>
          ) : pendingOld ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">舊罐</p>
              <p className="text-xl font-semibold tracking-wide">{pendingOld}</p>
              <p className="text-sm text-zinc-600">確認這是客人帶回的罐子</p>
              <button
                type="button"
                disabled={busy}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void confirmOld()}
              >
                {busy ? '確認中...' : '確認回收'}
              </button>
              <button
                type="button"
                className="w-full text-sm text-zinc-500"
                onClick={() => {
                  setPendingOld('');
                  setError(null);
                  setRetryAction(null);
                }}
              >
                重新掃描
              </button>
            </div>
          ) : (
            <JarSerialPanel
              primaryLabel="掃描舊罐"
              secondaryLabel="手動輸入序號"
              submitLabel="查詢"
              busy={busy}
              onSerial={takeOldSerial}
            />
          )}
        </StepBlock>

        <StepBlock
          n={2}
          title="綁新罐"
          state={newReady ? 'done' : currentStep === 2 ? 'active' : 'locked'}
        >
          {currentStep >= 2 ? (
            newReady ? (
              <p className="text-sm text-zinc-600">新罐 {pendingNew}</p>
            ) : pendingNew ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">新罐</p>
                <p className="text-xl font-semibold tracking-wide">{pendingNew}</p>
                <button
                  type="button"
                  disabled={busy}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => setNewConfirmed(true)}
                >
                  確認這個新罐
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-zinc-500"
                  onClick={() => {
                    setPendingNew('');
                    setNewConfirmed(false);
                    setError(null);
                  }}
                >
                  重新掃描
                </button>
              </div>
            ) : (
              <JarSerialPanel
                title="掃描新罐"
                primaryLabel="掃描新罐"
                secondaryLabel="手動輸入序號"
                submitLabel="確認"
                busy={busy}
                onSerial={takeNewSerial}
              />
            )
          ) : (
            <p className="text-sm text-zinc-400">請先完成上一步</p>
          )}
        </StepBlock>

        <StepBlock n={3} title="完成交付" state={currentStep === 3 ? 'active' : 'locked'}>
          {currentStep === 3 ? (
            <button
              type="button"
              disabled={busy}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void completeRefill()}
            >
              {busy ? '完成中...' : '完成換罐'}
            </button>
          ) : (
            <p className="text-sm text-zinc-400">舊罐與新罐都確認後才能交付</p>
          )}
        </StepBlock>
      </ol>

      {error ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {retryAction ? (
            <button
              type="button"
              className="text-sm text-zinc-600 underline"
              onClick={() => {
                setError(null);
                if (retryAction === 'old') setPendingOld('');
                if (retryAction === 'new') {
                  setPendingNew('');
                  setNewConfirmed(false);
                }
                setRetryAction(null);
              }}
            >
              {retryAction === 'new' ? '重新掃描' : '重新掃描'}
            </button>
          ) : (
            <p className="text-xs text-zinc-400">如果仍失敗，請聯絡匠寵</p>
          )}
        </div>
      ) : null}

      {!oldDone && !view.skipOldJar ? (
        <div className="mt-6 border-t border-neutral-200 pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-sm text-zinc-500"
            onClick={() => setMissingOpen((open) => !open)}
          >
            客人忘記帶空罐？
            <ChevronDown className={`h-4 w-4 transition ${missingOpen ? 'rotate-180' : ''}`} />
          </button>
          {missingOpen ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-zinc-600">
                沒有舊罐就不能直接交付。請客人線上補 NT$30，或下次帶空罐再領。店內不能代收現金。
              </p>
              <button
                type="button"
                disabled={busy}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void missing('topup')}
              >
                {busy ? '處理中...' : '請客人線上補 NT$30'}
              </button>
              <button
                type="button"
                disabled={busy}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-900 text-sm font-semibold disabled:opacity-60"
                onClick={() => void missing('keep')}
              >
                保留訂單，下次帶空罐再領
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </PanelShell>
  );
}

export function RefillSuccessPanel({
  customerName,
  newSerial,
  onDone,
}: {
  customerName: string;
  newSerial: string;
  onDone: () => void;
}) {
  return (
    <PanelShell title="換罐完成" onClose={onDone}>
      <p className="text-xs text-zinc-500">新罐</p>
      <p className="mt-1 text-2xl font-semibold tracking-wide">{newSerial}</p>
      <p className="mt-4 text-sm text-zinc-700">已交付給{customerName}</p>
      <button
        type="button"
        className="mt-8 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
        onClick={onDone}
      >
        完成
      </button>
    </PanelShell>
  );
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500"
          aria-label="關閉"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">{children}</div>
    </div>
  );
}

function StepBlock({
  n,
  title,
  state,
  children,
}: {
  n: number;
  title: string;
  state: 'done' | 'active' | 'locked';
  children: React.ReactNode;
}) {
  return (
    <li className={state === 'locked' ? 'opacity-50' : ''}>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            state === 'done' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 text-zinc-700'
          }`}
        >
          {state === 'done' ? <Check className="h-3 w-3" /> : n}
        </span>
        <p className="text-sm font-semibold text-zinc-900">
          {n}. {title}
        </p>
      </div>
      <div className="pl-8">{children}</div>
    </li>
  );
}
