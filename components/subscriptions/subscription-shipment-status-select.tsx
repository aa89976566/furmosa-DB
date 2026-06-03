'use client';

import { useRef } from 'react';
import { updateSubscriptionShipmentStatus } from '@/app/(main)/subscriptions/shipments/actions';
import { subscriptionShipmentStatusLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const OPTIONS_BY_STATUS: Record<string, Array<{ value: string; label: string }>> = {
  pending: [
    { value: 'pending', label: subscriptionShipmentStatusLabel.pending },
    { value: 'shipped', label: subscriptionShipmentStatusLabel.shipped },
    { value: 'skipped', label: subscriptionShipmentStatusLabel.skipped },
  ],
  packed: [
    { value: 'packed', label: subscriptionShipmentStatusLabel.packed },
    { value: 'shipped', label: subscriptionShipmentStatusLabel.shipped },
    { value: 'pending', label: subscriptionShipmentStatusLabel.pending },
    { value: 'skipped', label: subscriptionShipmentStatusLabel.skipped },
  ],
  shipped: [
    { value: 'shipped', label: subscriptionShipmentStatusLabel.shipped },
    { value: 'delivered', label: subscriptionShipmentStatusLabel.delivered },
    { value: 'pending', label: subscriptionShipmentStatusLabel.pending },
  ],
  delivered: [
    { value: 'delivered', label: subscriptionShipmentStatusLabel.delivered },
    { value: 'shipped', label: subscriptionShipmentStatusLabel.shipped },
    { value: 'pending', label: subscriptionShipmentStatusLabel.pending },
  ],
  skipped: [
    { value: 'skipped', label: subscriptionShipmentStatusLabel.skipped },
    { value: 'pending', label: subscriptionShipmentStatusLabel.pending },
  ],
};

function optionsFor(status: string) {
  return OPTIONS_BY_STATUS[status] ?? OPTIONS_BY_STATUS.pending;
}

export function SubscriptionShipmentStatusSelect({
  subscriptionShipmentId,
  status,
}: {
  subscriptionShipmentId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const options = optionsFor(status);

  return (
    <form
      ref={formRef}
      action={updateSubscriptionShipmentStatus}
      className="min-w-0"
      onChange={() => formRef.current?.requestSubmit()}
    >
      <input type="hidden" name="subscriptionShipmentId" value={subscriptionShipmentId} />
      <select
        name="next"
        defaultValue={status}
        className={cn(
          'w-full min-w-[5.5rem] max-w-[7.5rem] rounded-md border bg-background px-1.5 py-1 text-[11px] font-medium',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          status === 'delivered' && 'border-success/40 text-success',
          status === 'shipped' && 'border-info/40 text-info',
          (status === 'pending' || status === 'packed') && 'border-warning/40 text-amber-800 dark:text-amber-200',
        )}
        aria-label="出貨狀態"
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
