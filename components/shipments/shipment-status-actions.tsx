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
import { useFormStatus } from 'react-dom';

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
  inventoryWarnings = [],
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
  inventoryWarnings?: string[];
}) {
  if (allowedNext.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">此出貨單已結案，無法再變更物流狀態。</p>
    );
  }

  const primaryNext = allowedNext.find((next) => next !== 'pending' && next !== 'cancelled');
  const correctionNext = primaryNext
    ? allowedNext.filter((next) => next !== primaryNext)
    : allowedNext;

  return (
    <div className="space-y-3">
      {primaryNext ? (
        <div className="max-w-xl">
          <StatusActionCard
            shipmentId={shipmentId}
            next={primaryNext}
            currentStatus={currentStatus}
            defaultCarrier={defaultCarrier}
            defaultTracking={defaultTracking}
            defaultPickupStore={defaultPickupStore}
            defaultPickupName={defaultPickupName}
            defaultPickupPhone={defaultPickupPhone}
            inline={inline}
            queueStatus={queueStatus}
            inventoryWarnings={inventoryWarnings}
            primary
          />
        </div>
      ) : null}

      {correctionNext.length > 0 ? (
        <details className="group max-w-xl rounded-lg border border-border/70 bg-muted/10">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground">
            <span className="group-open:hidden">需要修正狀態？</span>
            <span className="hidden group-open:inline">收起狀態修正</span>
          </summary>
          <div className="grid gap-3 border-t border-border/70 p-3">
            {correctionNext.map((next) => (
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
                inventoryWarnings={inventoryWarnings}
              />
            ))}
          </div>
        </details>
      ) : null}
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
  inventoryWarnings,
  primary = false,
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
  inventoryWarnings: string[];
  primary?: boolean;
}) {
  const isShipping = next === 'shipped';
  const isDanger = next === 'cancelled';

  return (
    <form
      action={markShipmentStatus}
      onSubmit={(event) => {
        if (
          isDanger &&
          !window.confirm('確定要取消這張出貨單嗎？取消後將無法再變更物流狀態。')
        ) {
          event.preventDefault();
          return;
        }

        if (
          isShipping &&
          inventoryWarnings.length > 0 &&
          !window.confirm(`庫存提醒\n\n${inventoryWarnings.join('\n')}\n\n仍要標記為已寄出嗎？`)
        ) {
          event.preventDefault();
        }
      }}
      className={cn(
        'space-y-3 rounded-lg border p-4',
        isDanger
          ? 'border-destructive/40 bg-destructive/5'
          : primary
            ? 'border-border bg-card shadow-sm'
            : 'bg-muted/20',
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
          {inventoryWarnings.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">庫存不足仍可寄出</p>
              {inventoryWarnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
            </div>
          ) : null}
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
      {next === 'delivered' ? (
        <p className="text-xs text-success">確認送達後會自動把商品加進對方庫存</p>
      ) : null}

      <StatusSubmitButton next={next} isDanger={isDanger} />
    </form>
  );
}

function StatusSubmitButton({ next, isDanger }: { next: ShipmentStatus; isDanger: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      variant={isDanger ? 'outline' : 'default'}
      className={cn('w-full', isDanger && 'text-destructive hover:bg-destructive/10')}
    >
      {pending ? '處理中…' : nextActionLabel(next)}
    </Button>
  );
}
