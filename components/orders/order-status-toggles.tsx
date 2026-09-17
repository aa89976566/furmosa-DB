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
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;

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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
      {ORDER_STATUS_OPTIONS.map((s) => {
        const managedByShipment =
          hasActiveShipment && ['shipped', 'delivered', 'completed'].includes(s);
        return (
        <button
          key={s}
          type="button"
          disabled={optimisticStatus === s || isPending || managedByShipment}
          title={managedByShipment ? '請到出貨隊列更新物流狀態' : undefined}
          className={toggleButtonClass(
            optimisticStatus === s,
            isPending,
            s === 'cancelled',
          )}
          onClick={() => {
            startTransition(async () => {
              setActionError(null);
              setOptimisticStatus(s);
              const fd = new FormData();
              fd.set('orderId', orderId);
              fd.set('status', s);
              try {
                await updateOrderStatus(fd);
              } catch (error) {
                setActionError(error instanceof Error ? error.message : '更新訂單狀態失敗');
              }
            });
          }}
        >
          {orderStatusLabel[s] ?? s}
        </button>
        );
      })}
      </div>
      {hasActiveShipment ? (
        <p className="text-[11px] text-muted-foreground">已有出貨單；寄出、送達與完成請從出貨隊列更新。</p>
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
