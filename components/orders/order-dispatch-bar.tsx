'use client';

import { HandoffControl, ShipmentCorrectionButton } from '@/components/shipments/handoff-control';
import { shipmentStatusLabel } from '@/lib/shipment';

export function OrderDispatchBar({
  orderNumber,
  shipment,
  paymentReviewHold = false,
}: {
  orderNumber: string;
  paymentReviewHold?: boolean;
  shipment: {
    id: string;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    shippingMethod: string | null;
    cvsBrand: string | null;
  } | null;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">{orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            {shipment
              ? `物流狀態：${shipmentStatusLabel[shipment.status] ?? shipment.status}`
              : '尚未建立出貨單，不能標記已交寄'}
          </p>
        </div>
        {shipment ? (
          <div className="w-full sm:max-w-xs">
            <HandoffControl
              shipmentId={shipment.id}
              orderNumber={orderNumber}
              status={shipment.status}
              carrier={shipment.carrier}
              shippingMethod={shipment.shippingMethod}
              cvsBrand={shipment.cvsBrand}
              trackingNumber={shipment.trackingNumber}
              paymentReviewHold={paymentReviewHold}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OrderShipmentCorrection({
  shipmentId,
  status,
}: {
  shipmentId: string;
  status: string;
}) {
  if (status !== 'shipped' && status !== 'delivered') return null;
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">物流狀態修改</p>
      <p className="mt-1 text-xs text-muted-foreground">退回待出貨需要原因、確認，並寫入操作紀錄。</p>
      <div className="mt-3">
        <ShipmentCorrectionButton shipmentId={shipmentId} />
      </div>
    </div>
  );
}
