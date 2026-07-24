'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { markShipmentStatus } from '@/app/(main)/shipments/actions';
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

function queueSelectValue(status: string) {
  if (status === 'delivered') return 'delivered';
  if (status === 'shipped') return 'shipped';
  return 'pending';
}

const QUEUE_DELIVERED_OPTIONS = [
  { value: 'delivered', label: QUEUE_DELIVERED_LABEL },
  { value: 'shipped', label: '已寄出' },
  { value: 'pending', label: '未寄出' },
] as const;

function queueOptionsForStatus(status: string) {
  if (status === 'delivered') {
    return QUEUE_DELIVERED_OPTIONS;
  }
  if (status === 'shipped') {
    return QUEUE_IN_TRANSIT_OPTIONS;
  }
  return QUEUE_PENDING_OPTIONS;
}

export function ShipmentQueueStatusSelect({
  shipmentId,
  status,
  queueStatus,
  queueType,
  className,
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
  queueType?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const options = queueOptionsForStatus(status);
  const serverValue = queueSelectValue(status);
  const [displayValue, setDisplayValue] = useState(serverValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDisplayValue(serverValue);
  }, [serverValue]);

  if (status === 'cancelled') {
    return <span className="text-[10px] text-muted-foreground">已取消</span>;
  }

  return (
    <form
      ref={formRef}
      action={markShipmentStatus}
      className="min-w-0"
      onClick={(event) => event.stopPropagation()}
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="inline" value="1" />
      {queueStatus ? <input type="hidden" name="queueStatus" value={queueStatus} /> : null}
      {queueType ? <input type="hidden" name="queueType" value={queueType} /> : null}
      <select
        name="next"
        value={displayValue}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value;
          setDisplayValue(next);
          startTransition(() => {
            formRef.current?.requestSubmit();
          });
        }}
        className={cn(
          'w-full rounded-md border bg-background px-1.5 py-1 text-[11px] font-medium',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'min-w-[5.5rem] max-w-[7rem]',
          isPending && 'opacity-70',
          displayValue === 'delivered' && 'border-success/40 text-success',
          displayValue === 'shipped' && 'border-info/40 text-info',
          className,
        )}
        aria-label="運輸狀態"
        aria-busy={isPending}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}

export function ShipmentQueueStatusCell({
  shipmentId,
  status,
  queueStatus,
  queueType,
  className,
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
  queueType?: string;
  className?: string;
}) {
  return (
    <ShipmentQueueStatusSelect
      shipmentId={shipmentId}
      status={status}
      queueStatus={queueStatus}
      queueType={queueType}
      className={className}
    />
  );
}
