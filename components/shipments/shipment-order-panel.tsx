'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  fetchShipmentPanel,
  type ShipmentPanelData,
} from '@/app/(main)/shipments/actions';
import { ShipmentStatusActions } from '@/components/shipments/shipment-status-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import { paymentStatusLabel } from '@/lib/labels';
import { formatPlanContents } from '@/lib/plan-contents';
import { productLabel } from '@/lib/product-label';
import { resolveLogisticsFromShipment } from '@/lib/logistics-display';
import { resolveShipActionCarrierDefaults } from '@/lib/merchant-shipping-defaults';
import {
  nextStatuses,
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
  type ShipmentStatus,
} from '@/lib/shipment';
import { Loader2, MapPin, Package, Pencil, Phone, Truck } from 'lucide-react';
import Link from 'next/link';

export function ShipmentOrderPanel({
  shipmentId,
  queueStatus,
}: {
  shipmentId: string;
  queueStatus?: string;
}) {
  const [data, setData] = useState<ShipmentPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchShipmentPanel(shipmentId)
      .then((panel) => {
        if (cancelled) return;
        if (!panel) {
          setError('找不到這張出貨單');
          setData(null);
          return;
        }
        setData(panel);
      })
      .catch(() => {
        if (!cancelled) setError('載入失敗，請稍後再試');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        載入出貨內容…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        {error ?? '找不到這張出貨單'}
      </div>
    );
  }

  const paymentReviewHold = data.paymentReviewHold;
  const allowedNext = (
    paymentReviewHold
      ? nextStatuses(data.status).filter((status) => status !== 'shipped' && status !== 'delivered')
      : nextStatuses(data.status)
  ) as ShipmentStatus[];
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const shipCarrierDefaults = resolveShipActionCarrierDefaults({
    carrier: data.carrier,
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    recipientAddress: data.recipientAddress,
    merchant: data.merchant,
  });
  const logistics = resolveLogisticsFromShipment({
    type: data.type,
    carrier: data.carrier,
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    recipientAddress: data.recipientAddress,
    merchant: data.merchant,
    order: data.order,
  });
  const planContents = data.subscription?.planContents ?? [];
  const displayItems =
    data.items.length > 0
      ? data.items.map((item) => ({
          key: item.id,
          name: productLabel(item.productName, item.weightGrams),
          sku: item.sku,
          quantity: item.quantity,
          unit: item.unit,
        }))
      : planContents.map((item, index) => ({
          key: `plan-${index}`,
          name: item.weight ? `${item.name}（${item.weight}）` : item.name,
          sku: '-',
          quantity: 1,
          unit: '-',
        }));
  const displayQty =
    data.items.length > 0 ? totalQty : planContents.length > 0 ? planContents.length : 0;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{data.shipmentNumber}</span>
            {data.order ? (
              <span className="font-mono text-sm text-muted-foreground">
                訂單 {data.order.orderNumber}
              </span>
            ) : data.subscription ? (
              <span className="font-mono text-sm text-muted-foreground">
                訂閱 {data.subscription.subscriptionNo}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{shipmentTypeLabel[data.type] ?? data.type}</Badge>
            <Badge variant={shipmentStatusVariant[data.status] ?? 'secondary'}>
              {shipmentStatusLabel[data.status] ?? data.status}
            </Badge>
            {paymentReviewHold ? (
              <Badge variant="warning">{JIBA_PAYMENT_REVIEW_LABEL}</Badge>
            ) : null}
          </div>
          {data.type === 'customer_order' ? (
            <p className="text-xs text-muted-foreground">
              在此更新物流狀態後，關聯訂單的出貨與訂單狀態會同步。
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {data.order?.editable ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/orders/${data.order.id}/edit?returnTo=${encodeURIComponent(`/shipments?s=${data.id}`)}`}
              >
                <Pencil className="mr-1 h-4 w-4" />
                修改訂單
              </Link>
            </Button>
          ) : null}
          {data.carrier || data.trackingNumber ? (
            <div className="text-right text-xs text-muted-foreground">
              {data.carrier ? <div>{data.carrier}</div> : null}
              {data.trackingNumber ? (
                <div className="font-mono">{data.trackingNumber}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-info" />
            運輸與收件
          </h3>
          {data.order?.editable ? (
            <p className="mt-2 text-xs text-muted-foreground">
              可修改商品、數量、金額與收件資料；儲存後會同步更新此出貨單。
            </p>
          ) : data.order?.editBlockedReason ? (
            <p className="mt-2 text-xs text-muted-foreground">{data.order.editBlockedReason}</p>
          ) : null}
          <dl className="mt-4 space-y-3 text-sm">
            <PanelRow label="物流" value={logistics.carrierLabel} />
            <PanelRow label="收件人" value={logistics.contactName} />
            {logistics.phone !== '—' ? (
              <PanelRow
                label="電話"
                value={
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {logistics.phone}
                  </span>
                }
              />
            ) : null}
            <PanelRow
              label="寄送地"
              value={
                <span className="flex items-start justify-end gap-1">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {logistics.destination}
                  </span>
                </span>
              }
            />
            {data.order ? (
              <>
                <PanelRow
                  label="付款"
                  value={paymentStatusLabel[data.order.paymentStatus] ?? data.order.paymentStatus}
                />
                <PanelRow
                  label="運費"
                  value={data.fulfillmentFeeLabel ?? data.order.shippingFeeType}
                />
              </>
            ) : null}
          </dl>
        </section>

        <section className="min-w-0 rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 text-info" />
            出貨品項
            <span className="text-xs font-normal text-muted-foreground">
              {displayItems.length} 項 · 共 {displayQty} 件
            </span>
          </h3>
          {data.subscription && data.items.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              訂閱方案：{data.subscription.planName ?? '未命名方案'}
              {planContents.length > 0 ? ` · ${formatPlanContents(planContents)}` : ''}
            </p>
          ) : null}
          <ul className="mt-4 space-y-2 md:hidden">
            {displayItems.map((item) => (
              <li
                key={item.key}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
              >
                <p className="font-medium break-words [overflow-wrap:anywhere]">{item.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{item.sku}</span>
                  <span>
                    數量 <span className="font-semibold text-foreground">{item.quantity}</span>
                  </span>
                  <span>單位 {item.unit ?? '-'}</span>
                </div>
              </li>
            ))}
          </ul>
          <Table className="mt-4 hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-center">單位</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="text-sm font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {item.unit ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">物流狀態</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {paymentReviewHold
            ? `此單仍在${JIBA_PAYMENT_REVIEW_LABEL}，不可標記已寄出。`
            : '寄出時請填寫物流商與追蹤碼；客戶訂單會一併更新。'}
        </p>
        <div className="mt-4">
          <ShipmentStatusActions
            shipmentId={data.id}
            currentStatus={data.status}
            allowedNext={allowedNext}
            defaultCarrier={shipCarrierDefaults.defaultCarrier}
            defaultTracking={data.trackingNumber}
            defaultPickupStore={shipCarrierDefaults.pickupStore}
            defaultPickupName={shipCarrierDefaults.pickupName}
            defaultPickupPhone={shipCarrierDefaults.pickupPhone}
            inline
            queueStatus={queueStatus}
          />
        </div>
      </section>
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground sm:w-14">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium break-words [overflow-wrap:anywhere] sm:text-right">
        {value}
      </dd>
    </div>
  );
}
