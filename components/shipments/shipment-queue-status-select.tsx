'use client';

import { useRef } from 'react';
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

function queueOptionsForStatus(status: string) {
  if (status === 'shipped' || status === 'delivered') {
    return QUEUE_IN_TRANSIT_OPTIONS;
  }
  return QUEUE_PENDING_OPTIONS;
}

export function ShipmentQueueStatusSelect({
  shipmentId,
  status,
  queueStatus,
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const options = queueOptionsForStatus(status);
  const value = queueSelectValue(status);

  if (status === 'cancelled') {
    return <span className="text-[10px] text-muted-foreground">已取消</span>;
  }

  const readOnly = status === 'delivered';

  return (
    <form
      ref={formRef}
      action={markShipmentStatus}
      className="min-w-0"
      onClick={(event) => event.stopPropagation()}
      onChange={() => {
        if (!readOnly) formRef.current?.requestSubmit();
      }}
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="inline" value="1" />
      {queueStatus ? <input type="hidden" name="queueStatus" value={queueStatus} /> : null}
      <select
        name="next"
        defaultValue={value}
        disabled={readOnly}
        className={cn(
          'w-full min-w-[5.5rem] max-w-[7rem] rounded-md border bg-background px-1.5 py-1 text-[11px] font-medium',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          readOnly && 'cursor-default opacity-80',
          value === 'delivered' && 'border-success/40 text-success',
          value === 'shipped' && 'border-info/40 text-info',
        )}
        aria-label="運輸狀態"
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
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
}) {
  return (
    <ShipmentQueueStatusSelect
      shipmentId={shipmentId}
      status={status}
      queueStatus={queueStatus}
    />
  );
}
