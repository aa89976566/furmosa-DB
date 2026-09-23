'use client';

import { useOptimistic, useState, useTransition } from 'react';
import {
  updateOrderPaymentStatus,
  updateOrderStatus,
} from '@/app/(main)/orders/actions';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const ORDER_STATUS_OPTIONS = [
  'draft',
  'confirmed',
  'packed',
  'cancelled',
] as const;

const STATUS_RANK: Record<string, number> = {
  draft: 0,
  confirmed: 1,
  packed: 2,
};

const PAYMENT_STATUS_OPTIONS = [
  'unpaid',
  'partial',
  'paid',
  'cod',
  'refunded',
] as const;

function toggleButtonClass(active: boolean, pending: boolean, danger = false) {
  return cn(
    'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
    active && !danger && 'border-primary bg-primary text-primary-foreground',
    active && danger && 'border-destructive bg-destructive text-destructive-foreground',
    !active && 'border-border bg-background hover:bg-muted',
    pending && 'opacity-70',
    'disabled:cursor-not-allowed disabled:opacity-50',
  );
}

export function OrderStatusToggles({
  orderId,
  status,
  hasActiveShipment = false,
}: {
  orderId: string;
  status: string;
  hasActiveShipment?: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  function submit(nextStatus: string, withReason: boolean) {
    startTransition(async () => {
      setActionError(null);
      const fd = new FormData();
      fd.set('orderId', orderId);
      fd.set('status', nextStatus);
      if (withReason) {
        fd.set('reason', reason.trim());
        fd.set('statusChangeConfirmed', confirmed ? '1' : '');
      }
      try {
        await updateOrderStatus(fd);
        setOptimisticStatus(nextStatus);
        setPendingChange(null);
        setReason('');
        setConfirmed(false);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : '更新訂單狀態失敗');
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
      {ORDER_STATUS_OPTIONS.map((s) => {
        const rollback = s === 'cancelled' || (STATUS_RANK[s] ?? 99) < (STATUS_RANK[status] ?? 0);
        return (
        <button
          key={s}
          type="button"
          disabled={optimisticStatus === s || isPending}
          className={toggleButtonClass(
            optimisticStatus === s,
            isPending,
            s === 'cancelled',
          )}
          onClick={() => {
            if (rollback) {
              setPendingChange(s);
              setConfirmed(false);
              setReason('');
              return;
            }
            submit(s, false);
          }}
        >
          {orderStatusLabel[s] ?? s}
        </button>
        );
      })}
      </div>
      {pendingChange ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium">
            確認改為「{orderStatusLabel[pendingChange] ?? pendingChange}」？需要原因與再次確認。
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border px-2 py-1 text-sm"
            rows={2}
            placeholder="請填寫原因"
          />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            我確認這次狀態變更
          </label>
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs"
            disabled={isPending || !confirmed || reason.trim().length < 2}
            onClick={() => submit(pendingChange, true)}
          >
            {isPending ? '處理中…' : '確認變更'}
          </button>
        </div>
      ) : null}
      {hasActiveShipment ? (
        <p className="text-[11px] text-muted-foreground">已有出貨單；寄出、送達與完成請用下方的交寄操作，不會在這裡自動標記。</p>
      ) : null}
      {actionError ? <p className="text-[11px] text-destructive" role="alert">{actionError}</p> : null}
    </div>
  );
}

export function OrderPaymentStatusToggles({
  orderId,
  paymentStatus,
}: {
  orderId: string;
  paymentStatus: string;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(paymentStatus);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-1.5">
      {PAYMENT_STATUS_OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={optimisticStatus === s || isPending}
          className={toggleButtonClass(optimisticStatus === s, isPending)}
          onClick={() => {
            startTransition(async () => {
              setOptimisticStatus(s);
              const fd = new FormData();
              fd.set('orderId', orderId);
              fd.set('paymentStatus', s);
              await updateOrderPaymentStatus(fd);
            });
          }}
        >
          {paymentStatusLabel[s] ?? s}
        </button>
      ))}
    </div>
  );
}
