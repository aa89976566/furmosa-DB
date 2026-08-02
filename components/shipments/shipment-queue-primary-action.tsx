'use client';

import { useTransition } from 'react';
import { markShipmentStatus } from '@/app/(main)/shipments/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  primaryNextStatus,
  queuePrimaryActionLabel,
  shipmentStatusLabel,
  shipmentStatusVariant,
} from '@/lib/shipment';
import { cn } from '@/lib/utils';

export function ShipmentQueuePrimaryAction({
  shipmentId,
  status,
  queueStatus,
  queueType,
  className,
  layout = 'stack',
}: {
  shipmentId: string;
  status: string;
  queueStatus?: string;
  queueType?: string;
  className?: string;
  layout?: 'stack' | 'inline';
}) {
  const [isPending, startTransition] = useTransition();
  const next = primaryNextStatus(status);

  function submitPrimary() {
    if (!next || isPending) return;
    const fd = new FormData();
    fd.set('shipmentId', shipmentId);
    fd.set('next', next);
    fd.set('inline', '1');
    if (queueStatus) fd.set('queueStatus', queueStatus);
    if (queueType) fd.set('queueType', queueType);
    startTransition(() => {
      void markShipmentStatus(fd);
    });
  }

  return (
    <div
      className={cn(
        layout === 'inline'
          ? 'flex flex-wrap items-center gap-2'
          : 'flex flex-col items-stretch gap-2',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Badge
        variant={shipmentStatusVariant[status] ?? 'secondary'}
        className="h-5 w-fit px-1.5 text-[10px] font-medium"
      >
        {shipmentStatusLabel[status] ?? status}
      </Badge>
      {next ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          aria-busy={isPending}
          onClick={submitPrimary}
          className="h-8 w-full min-w-[6.5rem] rounded-lg text-[11px] font-semibold tracking-wide sm:w-auto"
        >
          {isPending ? '更新中…' : queuePrimaryActionLabel(next)}
        </Button>
      ) : null}
    </div>
  );
}
