'use client';

import { useState } from 'react';
import { createPortal, useFormStatus } from 'react-dom';
import { markShipmentStatus } from '@/app/(main)/shipments/actions';
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import { cn } from '@/lib/utils';

export const QUEUE_DELIVERED_LABEL = '貨物到達';

const QUEUE_PENDING_OPTIONS = [
  { value: 'pending', label: '未寄出' },
  { value: 'shipped', label: '已寄出' },
] as const;

const QUEUE_PACKED_OPTIONS = [
  { value: 'packed', label: '未寄出' },
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
  if (status === 'packed') return 'packed';
  return 'pending';
}

function queueOptionsForStatus(status: string) {
  if (status === 'delivered') {
    return QUEUE_DELIVERED_OPTIONS;
  }
  if (status === 'shipped') {
    return QUEUE_IN_TRANSIT_OPTIONS;
  }
  if (status === 'packed') {
    return QUEUE_PACKED_OPTIONS;
  }
  return QUEUE_PENDING_OPTIONS;
}

/** 與系統黑白視覺一致：只有目前狀態使用黑底白字。 */
function statusChipClass(active: boolean) {
  return active
    ? 'border-black bg-black text-white shadow-sm'
    : 'border-transparent bg-transparent text-muted-foreground hover:bg-black/[0.04] hover:text-foreground';
}

export function ShipmentQueueStatusSelect({
  shipmentId,
  status,
  queueStatus,
  queueType,
  paymentReviewHold = false,
  inventoryWarnings = [],
  className,
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
  queueType?: string;
  paymentReviewHold?: boolean;
  inventoryWarnings?: string[];
  className?: string;
}) {
  const options = queueOptionsForStatus(status);
  const serverValue = queueSelectValue(status);
  const [confirmShip, setConfirmShip] = useState(false);
  const formId = `shipment-status-${shipmentId}`;

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

  return (
    <>
    <form id={formId} action={markShipmentStatus} className={cn('space-y-1.5', className)}>
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="inline" value="1" />
      {queueStatus ? <input type="hidden" name="queueStatus" value={queueStatus} /> : null}
      {queueType ? <input type="hidden" name="queueType" value={queueType} /> : null}
      <div
        role="group"
        aria-label="運輸狀態"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="inline-flex w-full max-w-full gap-0.5 rounded-xl border border-border/60 bg-muted/40 p-0.5"
      >
        {options.map((option) => {
          const active = serverValue === option.value;
          return (
            <QueueStatusSubmitButton
              key={option.value}
              option={option}
              active={active}
              onConfirmShip={option.value === 'shipped' ? () => setConfirmShip(true) : undefined}
            />
          );
        })}
      </div>
      {inventoryWarnings.length > 0 && status === 'packed' ? (
        <p className="text-[11px] leading-snug text-amber-700" role="status">
          庫存提醒：{inventoryWarnings.join('；')}
        </p>
      ) : null}
    </form>
    {confirmShip && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
            role="presentation"
            onClick={() => setConfirmShip(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`confirm-ship-${shipmentId}`}
              className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id={`confirm-ship-${shipmentId}`} className="text-lg font-semibold text-foreground">
                確認已完成交寄？
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                確認後會直接標記為「已寄出」，並移到運送中。
              </p>
              {inventoryWarnings.length > 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-foreground">
                  <p className="font-semibold">庫存提醒</p>
                  {inventoryWarnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
                </div>
              ) : null}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-medium"
                  onClick={() => setConfirmShip(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  form={formId}
                  name="next"
                  value="shipped"
                  autoFocus
                  className="min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white"
                >
                  確認已寄出
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}

function QueueStatusSubmitButton({
  option,
  active,
  onConfirmShip,
}: {
  option: { value: string; label: string };
  active: boolean;
  onConfirmShip?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type={onConfirmShip ? 'button' : 'submit'}
      name={onConfirmShip ? undefined : 'next'}
      value={option.value}
      disabled={active || pending}
      aria-pressed={active}
      onClick={onConfirmShip}
      className={cn(
        'min-h-[44px] flex-1 touch-manipulation rounded-[10px] border px-2.5 py-1.5',
        'text-[11px] font-medium tracking-wide',
        'transition-[background-color,color,box-shadow,border-color] duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed',
        statusChipClass(active),
      )}
    >
      {pending && !active ? '處理中…' : option.label}
    </button>
  );
}

export function ShipmentQueueStatusCell({
  shipmentId,
  status,
  queueStatus,
  queueType,
  paymentReviewHold,
  inventoryWarnings,
  className,
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
  queueType?: string;
  paymentReviewHold?: boolean;
  inventoryWarnings?: string[];
  className?: string;
}) {
  return (
    <ShipmentQueueStatusSelect
      shipmentId={shipmentId}
      status={status}
      queueStatus={queueStatus}
      queueType={queueType}
      paymentReviewHold={paymentReviewHold}
      inventoryWarnings={inventoryWarnings}
      className={className}
    />
  );
}
