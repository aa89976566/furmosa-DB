'use client';

import { markShipmentStatus } from '@/app/(main)/shipments/actions';
import { CarrierSelect } from '@/components/shared/carrier-select';
import { Button } from '@/components/ui/button';
import {
  nextActionLabel,
  type ShipmentStatus,
} from '@/lib/shipment';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Truck, XCircle } from 'lucide-react';

export function ShipmentStatusActions({
  shipmentId,
  currentStatus,
  allowedNext,
  defaultCarrier,
  defaultTracking,
  defaultPickupStore,
  defaultPickupName,
  defaultPickupPhone,
  inline = false,
  queueStatus,
}: {
  shipmentId: string;
  currentStatus: string;
  allowedNext: ShipmentStatus[];
  defaultCarrier: string | null;
  defaultTracking: string | null;
  defaultPickupStore?: string | null;
  defaultPickupName?: string | null;
  defaultPickupPhone?: string | null;
  inline?: boolean;
  queueStatus?: string;
}) {
  if (allowedNext.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">此出貨單已結案，無法再變更物流狀態。</p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {allowedNext.map((next) => (
        <StatusActionCard
          key={next}
          shipmentId={shipmentId}
          next={next}
          currentStatus={currentStatus}
          defaultCarrier={defaultCarrier}
          defaultTracking={defaultTracking}
          defaultPickupStore={defaultPickupStore}
          defaultPickupName={defaultPickupName}
          defaultPickupPhone={defaultPickupPhone}
          inline={inline}
          queueStatus={queueStatus}
        />
      ))}
    </div>
  );
}

function StatusActionCard({
  shipmentId,
  next,
  currentStatus,
  defaultCarrier,
  defaultTracking,
  defaultPickupStore,
  defaultPickupName,
  defaultPickupPhone,
  inline,
  queueStatus,
}: {
  shipmentId: string;
  next: ShipmentStatus;
  currentStatus: string;
  defaultCarrier: string | null;
  defaultTracking: string | null;
  defaultPickupStore?: string | null;
  defaultPickupName?: string | null;
  defaultPickupPhone?: string | null;
  inline?: boolean;
  queueStatus?: string;
}) {
  const isShipping = next === 'shipped';
  const isDanger = next === 'cancelled';

  return (
    <form
      action={markShipmentStatus}
      className={cn(
        'space-y-3 rounded-lg border p-4',
        isDanger ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/20',
      )}
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="next" value={next} />
      {inline ? <input type="hidden" name="inline" value="1" /> : null}
      {inline && queueStatus ? (
        <input type="hidden" name="queueStatus" value={queueStatus} />
      ) : null}

      <div className="flex items-center gap-2">
        {next === 'shipped' && <Truck className="h-4 w-4 text-info" />}
        {next === 'delivered' && <CheckCircle2 className="h-4 w-4 text-success" />}
        {next === 'cancelled' && <XCircle className="h-4 w-4 text-destructive" />}
        {next === 'pending' && <Clock className="h-4 w-4 text-warning" />}
        <h3 className="text-sm font-semibold">{nextActionLabel(next)}</h3>
      </div>

      {isShipping ? (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">物流商</label>
            <CarrierSelect
              defaultValue={defaultCarrier}
              defaultPickupStore={defaultPickupStore}
              defaultPickupName={defaultPickupName}
              defaultPickupPhone={defaultPickupPhone}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">追蹤碼</label>
            <input
              name="trackingNumber"
              defaultValue={defaultTracking ?? ''}
              placeholder="1234-5678-9012"
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </>
      ) : null}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">備註（選填）</label>
        <input
          name="note"
          placeholder={
            next === 'delivered'
              ? '收件人簽收 / 放置位置...'
              : next === 'cancelled'
                ? '取消原因...'
                : ''
          }
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {next === 'delivered' && currentStatus !== 'shipped' ? (
        <p className="text-xs text-warning">通常要先「已寄出」再「已送達」。確定可以跳過嗎？</p>
      ) : null}

      <Button
        type="submit"
        variant={isDanger ? 'outline' : 'default'}
        className={cn('w-full', isDanger && 'text-destructive hover:bg-destructive/10')}
      >
        {nextActionLabel(next)}
      </Button>
    </form>
  );
}
