'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markShipmentStatusFromQueue } from '@/app/(main)/shipments/actions';
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import { MERCHANT_RESTOCK_SHIPMENT_TYPE } from '@/lib/shipment-status-policy';
import { cn } from '@/lib/utils';

export const QUEUE_DELIVERED_LABEL = '貨物到達';

const QUEUE_PENDING_OPTIONS = [
  { value: 'pending', label: '未寄出' },
  { value: 'shipped', label: '已寄出' },
] as const;

const QUEUE_IN_TRANSIT_OPTIONS = [
  { value: 'shipped', label: '已寄出' },
  { value: 'delivered', label: QUEUE_DELIVERED_LABEL },
] as const;

const QUEUE_DELIVERED_OPTIONS = [
  { value: 'delivered', label: QUEUE_DELIVERED_LABEL },
  { value: 'shipped', label: '已寄出' },
  { value: 'pending', label: '未寄出' },
] as const;

function queueSelectValue(status: string) {
  if (status === 'delivered') return 'delivered';
  if (status === 'shipped') return 'shipped';
  return 'pending';
}

function queueOptionsForStatus(status: string, type?: string) {
  if (status === 'delivered' && type === MERCHANT_RESTOCK_SHIPMENT_TYPE) {
    return [{ value: 'delivered', label: QUEUE_DELIVERED_LABEL }] as const;
  }
  if (status === 'delivered') {
    return QUEUE_DELIVERED_OPTIONS;
  }
  if (status === 'shipped') {
    return QUEUE_IN_TRANSIT_OPTIONS;
  }
  return QUEUE_PENDING_OPTIONS;
}

/** Soft status chip styles — muted fills, no harsh primaries */
function statusChipClass(value: string, active: boolean) {
  if (!active) {
    return cn(
      'border-transparent bg-transparent text-muted-foreground',
      'hover:bg-black/[0.04] hover:text-foreground',
    );
  }
  switch (value) {
    case 'delivered':
      return 'border-emerald-200/80 bg-emerald-50 text-emerald-800 shadow-sm';
    case 'shipped':
      return 'border-sky-200/80 bg-sky-50 text-sky-800 shadow-sm';
    case 'pending':
    default:
      return 'border-amber-200/80 bg-amber-50 text-amber-900 shadow-sm';
  }
}

function buildInlineSuccessHref(input: {
  next: string;
  shipmentId: string;
  queueStatus?: string;
  queueType?: string;
}) {
  const params = new URLSearchParams();
  if (input.next === 'shipped') {
    params.set('status', 'shipped');
    params.set('s', input.shipmentId);
    if (input.queueType) params.set('type', input.queueType);
    return `/shipments?${params.toString()}`;
  }
  if (input.next === 'delivered') {
    // 已送達會離開「在途」；回待出貨列表並帶成功提示
    params.set('delivered', '1');
    if (input.queueType) params.set('type', input.queueType);
    return `/shipments?${params.toString()}`;
  }
  params.set('s', input.shipmentId);
  if (input.queueStatus) params.set('status', input.queueStatus);
  if (input.queueType) params.set('type', input.queueType);
  return `/shipments?${params.toString()}`;
}

export function ShipmentQueueStatusSelect({
  shipmentId,
  status,
  shipmentType,
  queueStatus,
  queueType,
  paymentReviewHold = false,
  className,
}: {
  shipmentId: string;
  status: string;
  shipmentType?: string;
  queueStatus?: string;
  queueType?: string;
  paymentReviewHold?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const options = queueOptionsForStatus(status, shipmentType);
  const serverValue = queueSelectValue(status);
  const [displayValue, setDisplayValue] = useState(serverValue);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDisplayValue(serverValue);
  }, [serverValue]);

  if (status === 'cancelled') {
    return <span className="text-[10px] text-muted-foreground">已取消</span>;
  }

  if (paymentReviewHold && (status === 'pending' || status === 'packed')) {
    return (
      <div className={cn('space-y-1', className)}>
        <p className="text-[11px] font-medium text-amber-800">{JIBA_PAYMENT_REVIEW_LABEL}</p>
        <p className="text-[10px] text-muted-foreground">尚未核對入帳，不可標記已寄出</p>
      </div>
    );
  }

  function submitNext(next: string) {
    if (next === displayValue || isPending) return;
    setActionError(null);
    setDisplayValue(next);
    const fd = new FormData();
    fd.set('shipmentId', shipmentId);
    fd.set('next', next);
    fd.set('inline', '1');
    if (queueStatus) fd.set('queueStatus', queueStatus);
    if (queueType) fd.set('queueType', queueType);
    startTransition(() => {
      void (async () => {
        try {
          const result = await markShipmentStatusFromQueue(fd);
          if (!result || result.ok === false) {
            setDisplayValue(serverValue);
            setActionError(result?.error ?? '更新出貨狀態失敗，請稍後再試');
            return;
          }
          const href = buildInlineSuccessHref({
            next: result.next,
            shipmentId: result.shipmentId,
            queueStatus,
            queueType,
          });
          router.push(href);
          router.refresh();
        } catch (error) {
          setDisplayValue(serverValue);
          setActionError(
            error instanceof Error ? error.message.slice(0, 120) : '更新出貨狀態失敗，請稍後再試',
          );
        }
      })();
    });
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        role="group"
        aria-label="運輸狀態"
        aria-busy={isPending}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          'inline-flex w-full max-w-full gap-0.5 rounded-xl border border-border/60 bg-muted/40 p-0.5',
          isPending && 'pointer-events-none opacity-70',
        )}
      >
        {options.map((option) => {
          const active = displayValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              aria-pressed={active}
              onClick={() => submitNext(option.value)}
              className={cn(
                'min-h-[44px] flex-1 touch-manipulation rounded-[10px] border px-2.5 py-1.5',
                'text-[11px] font-medium tracking-wide',
                'transition-[background-color,color,box-shadow,border-color] duration-200 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed',
                statusChipClass(option.value, active),
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {actionError ? (
        <p className="text-[11px] leading-snug text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

export function ShipmentQueueStatusCell({
  shipmentId,
  status,
  shipmentType,
  queueStatus,
  queueType,
  paymentReviewHold,
  className,
}: {
  shipmentId: string;
  status: string;
  shipmentType?: string;
  queueStatus?: string;
  queueType?: string;
  paymentReviewHold?: boolean;
  className?: string;
}) {
  return (
    <ShipmentQueueStatusSelect
      shipmentId={shipmentId}
      status={status}
      shipmentType={shipmentType}
      queueStatus={queueStatus}
      queueType={queueType}
      paymentReviewHold={paymentReviewHold}
      className={className}
    />
  );
}
