'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markShipmentStatusFromQueue } from '@/app/(main)/shipments/actions';
import { Button } from '@/components/ui/button';
import {
  carrierKindLabel,
  dispatchAction,
  isValidTrackingNumber,
  resolveCarrierKind,
  type DispatchAction,
} from '@/lib/shipment-dispatch';
import { shipmentStatusLabel } from '@/lib/shipment';
import { cn } from '@/lib/utils';

const UNDO_MS = 8000;

export function HandoffControl({
  shipmentId,
  orderNumber,
  status,
  carrier,
  shippingMethod,
  cvsBrand,
  trackingNumber,
  inventoryWarnings = [],
  paymentReviewHold = false,
}: {
  shipmentId: string;
  orderNumber: string;
  status: string;
  carrier?: string | null;
  shippingMethod?: string | null;
  cvsBrand?: string | null;
  trackingNumber?: string | null;
  inventoryWarnings?: string[];
  paymentReviewHold?: boolean;
}) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localTracking, setLocalTracking] = useState<string | null>(null);
  const effectiveStatus = localStatus ?? status;
  const effectiveTracking = localTracking ?? trackingNumber;
  const action = dispatchAction({
    status: effectiveStatus,
    carrier,
    shippingMethod,
    cvsBrand,
    trackingNumber: effectiveTracking,
  });
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(trackingNumber ?? '');
  const [explicitHandoff, setExplicitHandoff] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ shipmentId: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setArmed(false);
    setExplicitHandoff(false);
    setError(null);
    const timer = window.setTimeout(() => setArmed(true), 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const kind = resolveCarrierKind({ carrier, shippingMethod, cvsBrand });
  const methodLabel = carrier?.trim() || carrierKindLabel(kind);
  const canSubmit =
    action.type !== 'hidden' &&
    armed &&
    !pending &&
    (action.type === 'create-label'
      ? isValidTrackingNumber(tracking)
      : explicitHandoff);

  async function submit() {
    if (!canSubmit || pending) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set('shipmentId', shipmentId);
    form.set('carrier', carrier ?? '');
    form.set('trackingNumber', tracking.trim());
    if (action.type === 'create-label') {
      form.set('next', status === 'packed' ? 'packed' : 'packed');
      form.set('labelIntent', '1');
    } else {
      form.set('next', 'shipped');
      form.set('handoffConfirmed', '1');
      if (explicitHandoff) form.set('explicitHandoff', '1');
    }
    const result = await markShipmentStatusFromQueue(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    if (result.next === 'shipped') {
      setLocalStatus('shipped');
      setNotice('已標成已交寄');
      setUndo({ shipmentId });
      window.setTimeout(() => router.refresh(), UNDO_MS);
      return;
    }
    setLocalStatus(result.next);
    setLocalTracking(tracking.trim());
    setNotice('已建立寄件單，尚未標成已交寄');
    router.refresh();
  }

  async function undoHandoff() {
    if (!undo || pending) return;
    setPending(true);
    const form = new FormData();
    form.set('shipmentId', undo.shipmentId);
    form.set('next', 'pending');
    form.set('correctionConfirmed', '1');
    form.set('note', '誤按已交寄，立即撤回');
    const result = await markShipmentStatusFromQueue(form);
    setPending(false);
    if (!result.ok) {
      setUndo(null);
      setNotice(result.error);
      return;
    }
    setUndo(null);
    setLocalStatus('pending');
    setNotice('已撤回為待出貨');
    router.refresh();
  }

  if (paymentReviewHold && action.type !== 'hidden') {
    return <p className="text-xs text-muted-foreground">尚未核對入帳，不可標記已交寄</p>;
  }

  if (action.type === 'hidden' && !open && !notice) return null;

  return (
    <>
      {action.type === 'hidden' ? (
        <p className="text-sm text-muted-foreground">
          {shipmentStatusLabel[effectiveStatus] ?? effectiveStatus}。已交寄後不能再重複送出。
        </p>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-2 border-foreground bg-background text-sm font-semibold"
            onClick={() => {
              setTracking(effectiveTracking ?? '');
              setOpen(true);
            }}
          >
            {action.label}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            這是高風險操作。頁面載入或點到其他地方都不會送出。
          </p>
        </>
      )}
      {open ? (
        <HandoffDialog
          action={action}
          orderNumber={orderNumber}
          methodLabel={methodLabel}
          statusLabel={shipmentStatusLabel[status] ?? status}
          tracking={tracking}
          explicitHandoff={explicitHandoff}
          inventoryWarnings={inventoryWarnings}
          error={error}
          pending={pending}
          canSubmit={canSubmit}
          onTracking={setTracking}
          onExplicit={setExplicitHandoff}
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          onSubmit={submit}
        />
      ) : null}
      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-[120] flex w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg"
        >
          <span>{notice}</span>
          {undo ? (
            <button
              type="button"
              className="shrink-0 text-sm font-medium underline"
              disabled={pending}
              onClick={undoHandoff}
            >
              {pending ? '撤回中…' : '撤回'}
            </button>
          ) : (
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setNotice(null)}>
              關閉
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

function HandoffDialog({
  action,
  orderNumber,
  methodLabel,
  statusLabel,
  tracking,
  explicitHandoff,
  inventoryWarnings,
  error,
  pending,
  canSubmit,
  onTracking,
  onExplicit,
  onClose,
  onSubmit,
}: {
  action: DispatchAction;
  orderNumber: string;
  methodLabel: string;
  statusLabel: string;
  tracking: string;
  explicitHandoff: boolean;
  inventoryWarnings: string[];
  error: string | null;
  pending: boolean;
  canSubmit: boolean;
  onTracking: (value: string) => void;
  onExplicit: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (action.type === 'hidden') return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="handoff-title" className="text-lg font-semibold">
          {action.type === 'create-label' ? action.label : '確認已完成交寄？'}
        </h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">訂單編號</dt><dd className="font-mono">{orderNumber}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">物流方式</dt><dd>{methodLabel}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">目前狀態</dt><dd>{statusLabel}</dd></div>
        </dl>
        <label className="mt-4 block text-xs text-muted-foreground">
          物流單號
          <input
            value={tracking}
            onChange={(event) => onTracking(event.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="請輸入有效物流單號"
            autoComplete="off"
          />
        </label>
        {action.type === 'confirm-handoff' ? (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={explicitHandoff}
              onChange={(event) => onExplicit(event.target.checked)}
            />
            <span>我確認貨物已交給物流。沒有勾選就不會改成已交寄。</span>
          </label>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">建立寄件單只會保存單號，不會標成已交寄，也不會扣庫存。</p>
        )}
        {inventoryWarnings.length > 0 ? (
          <div className="mt-3 rounded-md border p-3 text-xs">
            {inventoryWarnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>取消</Button>
          <Button
            type="button"
            disabled={!canSubmit}
            aria-busy={pending}
            className={cn('border-2 border-foreground')}
            onClick={onSubmit}
          >
            {pending ? '處理中…' : action.type === 'create-label' ? '建立寄件單' : '確認已寄出'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ShipmentCorrectionButton({
  shipmentId,
  disabled = false,
}: {
  shipmentId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending || !confirmed || reason.trim().length < 2) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set('shipmentId', shipmentId);
    form.set('next', 'pending');
    form.set('correctionConfirmed', '1');
    form.set('note', reason.trim());
    const result = await markShipmentStatusFromQueue(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        撤回為待出貨
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center" onClick={() => !pending && setOpen(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border bg-background p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold">確認撤回為待出貨？</h2>
            <p className="mt-2 text-sm text-muted-foreground">只有尚未實際交寄時才能使用。系統會留下原因，並沿用出貨撤回的庫存反向帳。</p>
            <label className="mt-3 block text-sm">
              撤回原因
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} required className="mt-1 w-full rounded-md border px-3 py-2" rows={3} />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              我確認這是誤設出貨後的狀態修正
            </label>
            {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>取消</Button>
              <Button type="button" disabled={pending || !confirmed || reason.trim().length < 2} onClick={submit}>
                {pending ? '處理中…' : '確認撤回'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
