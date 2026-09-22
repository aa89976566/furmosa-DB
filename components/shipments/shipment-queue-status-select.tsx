'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markShipmentStatusFromQueue } from '@/app/(main)/shipments/actions';
import { HandoffControl } from '@/components/shipments/handoff-control';
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import { shipmentStatusLabel } from '@/lib/shipment';
import { cn } from '@/lib/utils';

export const QUEUE_DELIVERED_LABEL = '貨物到達';

function statusChipClass(active: boolean) {
  return active
    ? 'border-black bg-black text-white shadow-sm'
    : 'border-transparent bg-transparent text-muted-foreground';
}

export function ShipmentQueueStatusSelect({
  shipmentId,
  status,
  orderNumber,
  carrier,
  shippingMethod,
  cvsBrand,
  trackingNumber,
  paymentReviewHold = false,
  inventoryWarnings = [],
  className,
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
  queueType?: string;
  orderNumber?: string | null;
  carrier?: string | null;
  shippingMethod?: string | null;
  cvsBrand?: string | null;
  trackingNumber?: string | null;
  paymentReviewHold?: boolean;
  inventoryWarnings?: string[];
  className?: string;
}) {
  if (status === 'cancelled') {
    return <span className="text-[10px] text-muted-foreground">已取消</span>;
  }

  return (
    <div
      className={cn('space-y-2', className)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        role="group"
        aria-label="運輸狀態"
        className="inline-flex w-full max-w-full rounded-xl border border-border/60 bg-muted/40 p-0.5"
      >
        <span
          className={cn(
            'min-h-[44px] flex-1 rounded-[10px] border px-2.5 py-1.5 text-center text-[11px] font-medium',
            statusChipClass(true),
          )}
        >
          {status === 'shipped'
            ? '已寄出'
            : status === 'delivered'
              ? QUEUE_DELIVERED_LABEL
              : '未寄出'}
        </span>
      </div>
      {paymentReviewHold && (status === 'pending' || status === 'packed') ? (
        <div>
          <p className="text-[11px] font-medium text-amber-800">{JIBA_PAYMENT_REVIEW_LABEL}</p>
          <p className="text-[10px] text-muted-foreground">尚未核對入帳，不可標記已寄出</p>
        </div>
      ) : (
        <HandoffControl
          shipmentId={shipmentId}
          orderNumber={orderNumber || shipmentId}
          status={status}
          carrier={carrier}
          shippingMethod={shippingMethod}
          cvsBrand={cvsBrand}
          trackingNumber={trackingNumber}
          inventoryWarnings={inventoryWarnings}
        />
      )}
      {inventoryWarnings.length > 0 && status === 'packed' ? (
        <p className="text-[11px] leading-snug text-amber-700" role="status">
          庫存提醒：{inventoryWarnings.join('；')}
        </p>
      ) : null}
      {status === 'shipped' ? (
        <QueueStepButton
          shipmentId={shipmentId}
          next="delivered"
          title="確認貨物已到達？"
          description="確認後會標記為「貨物到達」，並移到待驗收。"
          label={QUEUE_DELIVERED_LABEL}
        />
      ) : null}
      {status === 'shipped' || status === 'delivered' ? (
        <QueueStepButton
          shipmentId={shipmentId}
          next="pending"
          title="確認改回未寄出？"
          description="這是物流狀態修正。確認後會改為「未寄出」，並移回待出貨。"
          label="確認改回未寄出"
          correction
        />
      ) : null}
      <p className="sr-only">{shipmentStatusLabel[status] ?? status}</p>
    </div>
  );
}

function QueueStepButton({
  shipmentId,
  next,
  title,
  description,
  label,
  correction = false,
}: {
  shipmentId: string;
  next: 'pending' | 'delivered';
  title: string;
  description: string;
  label: string;
  correction?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending) return;
    if (correction && reason.trim().length < 2) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set('shipmentId', shipmentId);
    form.set('next', next);
    if (correction) {
      form.set('correctionConfirmed', '1');
      form.set('note', reason.trim());
    }
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
    <>
      <button
        type="button"
        className="text-left text-[11px] text-muted-foreground underline"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            {correction ? (
              <label className="mt-3 block text-sm">
                撤回原因
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  rows={3}
                />
              </label>
            ) : null}
            {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border px-4 text-sm"
                onClick={() => setOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={pending || (correction && reason.trim().length < 2)}
                className="min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-70"
                onClick={submit}
              >
                {pending ? '正在標記…' : next === 'delivered' ? '確認貨物到達' : '確認改為未寄出'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ShipmentQueueStatusCell(
  props: {
    shipmentId: string;
    status: string;
    queueStatus?: string;
    queueType?: string;
    orderNumber?: string | null;
    carrier?: string | null;
    shippingMethod?: string | null;
    cvsBrand?: string | null;
    trackingNumber?: string | null;
    paymentReviewHold?: boolean;
    inventoryWarnings?: string[];
    className?: string;
  },
) {
  return <ShipmentQueueStatusSelect {...props} />;
}
