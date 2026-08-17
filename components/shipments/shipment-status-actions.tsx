'use client';

import { useState } from 'react';
import { markShipmentStatus } from '@/app/(main)/shipments/actions';
import { CarrierSelect } from '@/components/shared/carrier-select';
import { Button } from '@/components/ui/button';
import {
  nextActionLabel,
  type ShipmentStatus,
} from '@/lib/shipment';
import { partitionShipmentWriteActions } from '@/lib/shipment-queue-products';
import { CheckCircle2, ChevronDown, Clock, Truck, XCircle } from 'lucide-react';

const FIELD_CLASS =
  'block w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export { partitionShipmentWriteActions };

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
  orderLabel,
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
  /** 無障礙：寫入按鈕 aria-label 含訂單編號 */
  orderLabel?: string;
}) {
  if (allowedNext.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">此出貨單已結案，無法再變更物流狀態。</p>
    );
  }

  const { primary, danger } = partitionShipmentWriteActions(allowedNext);

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-5"
      data-shipment-status-actions="true"
      data-shipment-actions-layout="stack"
      onClick={(event) => event.stopPropagation()}
    >
      {primary.map((next) => (
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
          orderLabel={orderLabel}
        />
      ))}

      {danger.map((next) => (
        <CancelDangerZone
          key={next}
          shipmentId={shipmentId}
          next={next}
          inline={inline}
          queueStatus={queueStatus}
          orderLabel={orderLabel}
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
  orderLabel,
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
  orderLabel?: string;
}) {
  const isShipping = next === 'shipped';
  const actionLabel = nextActionLabel(next);
  const ariaLabel = orderLabel ? `${actionLabel}（${orderLabel}）` : actionLabel;

  return (
    <form
      action={markShipmentStatus}
      data-shipment-write-control="true"
      data-shipment-action={next}
      className="w-full min-w-0 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="next" value={next} />
      {inline ? <input type="hidden" name="inline" value="1" /> : null}
      {inline && queueStatus ? (
        <input type="hidden" name="queueStatus" value={queueStatus} />
      ) : null}

      <div className="flex min-w-0 items-start gap-2">
        {next === 'shipped' && <Truck className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
        {next === 'delivered' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
        {next === 'pending' && <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug break-words">{actionLabel}</h3>
          {isShipping ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground break-words">
              填寫物流商與必要聯絡資訊後標記寄出；關聯訂單狀態會同步更新。
            </p>
          ) : null}
        </div>
      </div>

      {isShipping ? (
        <div className="flex w-full min-w-0 flex-col gap-4">
          <div className="w-full min-w-0 space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">物流商</label>
            <CarrierSelect
              defaultValue={defaultCarrier}
              defaultPickupStore={defaultPickupStore}
              defaultPickupName={defaultPickupName}
              defaultPickupPhone={defaultPickupPhone}
              stackFields
              className="w-full min-w-0"
            />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">追蹤碼</label>
            <input
              name="trackingNumber"
              defaultValue={defaultTracking ?? ''}
              placeholder="1234-5678-9012"
              className={FIELD_CLASS}
            />
          </div>
        </div>
      ) : null}

      <div className="w-full min-w-0 space-y-1.5">
        <label className="block text-xs font-medium text-muted-foreground">備註（選填）</label>
        <input
          name="note"
          placeholder={
            next === 'delivered'
              ? '收件人簽收 / 放置位置...'
              : ''
          }
          className={FIELD_CLASS}
        />
      </div>

      {next === 'delivered' && currentStatus !== 'shipped' ? (
        <p className="text-xs text-warning">通常要先「已寄出」再「已送達」。確定可以跳過嗎？</p>
      ) : null}

      <Button type="submit" aria-label={ariaLabel} className="w-full min-w-0">
        {actionLabel}
      </Button>
    </form>
  );
}

function CancelDangerZone({
  shipmentId,
  next,
  inline,
  queueStatus,
  orderLabel,
}: {
  shipmentId: string;
  next: ShipmentStatus;
  inline?: boolean;
  queueStatus?: string;
  orderLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionLabel = nextActionLabel(next);
  const ariaLabel = orderLabel ? `${actionLabel}（${orderLabel}）` : actionLabel;
  const expandLabel = orderLabel ? `展開取消這張單（${orderLabel}）` : '展開取消這張單';

  return (
    <div
      className="w-full min-w-0 border-t border-border/70 pt-5"
      data-shipment-danger-zone="true"
      data-expanded={expanded ? 'true' : 'false'}
    >
      {!expanded ? (
        <Button
          type="button"
          variant="outline"
          className="w-full min-w-0 justify-between border-destructive/30 text-destructive hover:bg-destructive/5"
          aria-label={expandLabel}
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <span className="inline-flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            取消這張單
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      ) : (
        <form
          action={markShipmentStatus}
          data-shipment-write-control="true"
          data-shipment-action="cancelled"
          className="w-full min-w-0 space-y-4 rounded-xl border border-destructive/35 bg-destructive/[0.04] p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <input type="hidden" name="next" value={next} />
          {inline ? <input type="hidden" name="inline" value="1" /> : null}
          {inline && queueStatus ? (
            <input type="hidden" name="queueStatus" value={queueStatus} />
          ) : null}

          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="break-words">{actionLabel}</span>
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground break-words">
                取消後無法在此直接復原，請確認後再送出。
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs text-muted-foreground"
              onClick={() => setExpanded(false)}
              aria-label={orderLabel ? `收合取消區（${orderLabel}）` : '收合取消區'}
            >
              收合
            </Button>
          </div>

          <div className="w-full min-w-0 space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">備註（選填）</label>
            <input
              name="note"
              placeholder="取消原因..."
              className={FIELD_CLASS}
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            aria-label={ariaLabel}
            className="w-full min-w-0 text-destructive hover:bg-destructive/10"
          >
            {actionLabel}
          </Button>
        </form>
      )}
    </div>
  );
}
