'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  fetchShipmentPanel,
  type ShipmentPanelData,
} from '@/app/(main)/shipments/actions';
import { fetchProductProgramLabels } from '@/app/(main)/shipments/product-program-actions';
import { ShipmentStatusActions } from '@/components/shipments/shipment-status-actions';
import { Button } from '@/components/ui/button';
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import { paymentStatusLabel } from '@/lib/labels';
import { formatPlanContents } from '@/lib/plan-contents';
import { productLabel } from '@/lib/product-label';
import { resolveLogisticsFromShipment } from '@/lib/logistics-display';
import { resolveShipActionCarrierDefaults } from '@/lib/merchant-shipping-defaults';
import {
  nextStatuses,
  shipmentTypeLabel,
  type ShipmentStatus,
} from '@/lib/shipment';
import { ClipboardList, Loader2, Package, Pencil, StickyNote, Truck } from 'lucide-react';
import Link from 'next/link';

export function ShipmentOrderPanel({
  shipmentId,
  onTitleChange,
  queueStatus,
  queueType,
}: {
  shipmentId: string;
  onTitleChange?: (title: string) => void;
  queueStatus?: string;
  queueType?: string;
}) {
  const [data, setData] = useState<ShipmentPanelData | null>(null);
  const [programLabelsBySku, setProgramLabelsBySku] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProgramLabelsBySku({});

    fetchShipmentPanel(shipmentId)
      .then(async (panel) => {
        if (cancelled) return;
        if (!panel) {
          setError('找不到這張出貨單');
          setData(null);
          return;
        }
        setData(panel);
        const orderLabel =
          panel.order?.displayOrderNumber ||
          panel.subscription?.subscriptionNo ||
          panel.shipmentNumber;
        const partyLabel =
          (panel.type === 'merchant_restock' ? panel.merchant?.name : null) ||
          panel.recipientName ||
          panel.customer?.name;
        onTitleChange?.(
          partyLabel ? `${orderLabel} · ${partyLabel}` : orderLabel,
        );

        const skus = panel.items.map((item) => item.sku).filter(Boolean);
        if (skus.length > 0) {
          try {
            const labels = await fetchProductProgramLabels(skus);
            if (!cancelled) setProgramLabelsBySku(labels);
          } catch {
            // 計劃標籤是輔助資訊；查詢失敗不可阻塞出貨主流程。
            if (!cancelled) setProgramLabelsBySku({});
          }
        }
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
  }, [shipmentId, onTitleChange]);

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
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
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
          programLabel: programLabelsBySku[item.sku] ?? null,
        }))
      : planContents.map((item, index) => ({
          key: `plan-${index}`,
          name: item.weight ? `${item.name}（${item.weight}）` : item.name,
          sku: '-',
          quantity: 1,
          unit: '-',
          programLabel: null,
        }));
  const displayQty =
    data.items.length > 0 ? totalQty : planContents.length > 0 ? planContents.length : 0;
  const orderLabel =
    data.order?.displayOrderNumber || data.subscription?.subscriptionNo || data.shipmentNumber;
  const partyLabel =
    (data.type === 'merchant_restock' ? data.merchant?.name : null) ||
    data.recipientName ||
    data.customer?.name ||
    '姓名未設定';
  const allowedNext = (
    paymentReviewHold
      ? nextStatuses(data.status).filter((status) => status !== 'shipped')
      : nextStatuses(data.status)
  ) as ShipmentStatus[];
  const primaryNext = allowedNext.find((next) => next !== 'pending' && next !== 'cancelled');
  const shipCarrierDefaults = resolveShipActionCarrierDefaults({
    carrier: data.carrier,
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    recipientAddress: data.recipientAddress,
    merchant: data.merchant,
  });
  const quickActionReady = Boolean(
    primaryNext && (primaryNext !== 'shipped' || shipCarrierDefaults.defaultCarrier),
  );

  return (
    <div className="min-w-0 space-y-4">
      <div className="sticky top-0 z-10 -mx-4 border-b bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight">{orderLabel}</span>
          </div>
          <p className="text-sm font-medium text-foreground">{partyLabel}</p>
          <p className="text-xs text-muted-foreground">
            {shipmentTypeLabel[data.type] ?? data.type} · {data.carrier ?? '物流待確認'}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {primaryNext && quickActionReady ? (
            <ShipmentStatusActions
              shipmentId={data.id}
              currentStatus={data.status}
              allowedNext={[primaryNext]}
              defaultCarrier={shipCarrierDefaults.defaultCarrier}
              defaultTracking={data.trackingNumber}
              defaultPickupStore={shipCarrierDefaults.pickupStore}
              defaultPickupName={shipCarrierDefaults.pickupName}
              defaultPickupPhone={shipCarrierDefaults.pickupPhone}
              compact
              inline
              queueStatus={queueStatus}
              queueType={queueType}
              primaryLabel={primaryNext === 'shipped' ? '確認出貨' : undefined}
            />
          ) : null}
        </div>
      </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        {['pending', 'packed', 'shipped', 'delivered'].map((step, index) => {
          const order = ['pending', 'packed', 'shipped', 'delivered'];
          const currentIndex = data.status === 'received'
            ? order.length - 1
            : Math.max(0, order.indexOf(data.status));
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-1">
              <span className={`h-2 w-2 shrink-0 rounded-full ${done || current ? 'bg-primary' : 'bg-border'}`} />
              <span className={current ? 'font-semibold text-primary' : 'truncate text-muted-foreground'}>
                {step === 'pending' ? '待出貨' : step === 'packed' ? '備貨中' : step === 'shipped' ? '已出貨' : '已送達'}
              </span>
              {index < 3 ? <span className="mx-1 h-px flex-1 bg-border" /> : null}
            </div>
          );
        })}
      </div>

      {paymentReviewHold ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {JIBA_PAYMENT_REVIEW_LABEL}
        </div>
      ) : null}

      {data.order?.note ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <StickyNote className="h-4 w-4" />
            需要注意
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-relaxed">
            {data.order.note}
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4" />
            出貨品項
          </h3>
          <span className="text-xs text-muted-foreground">共 {displayQty} 件</span>
        </div>
        {data.subscription && data.items.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            訂閱方案：{data.subscription.planName ?? '未命名方案'}
            {planContents.length > 0 ? ` · ${formatPlanContents(planContents)}` : ''}
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {displayItems.map((item) => (
            <li key={item.key} className="flex items-start gap-3 rounded-md border bg-muted/10 px-3 py-2.5">
              <span
                aria-hidden="true"
                className="mt-1 h-4 w-4 shrink-0 rounded border border-border bg-muted/30"
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.sku}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{item.quantity} {item.unit ?? ''}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-2">
        <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-muted-foreground" />查看送貨備註</span>
            <span className="text-xs text-muted-foreground">{data.order?.note ? '有備註' : '無備註'}</span>
          </summary>
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            {data.order?.note ? <p className="whitespace-pre-line">{data.order.note}</p> : '目前沒有送貨備註。'}
            <p className="mt-2 text-xs">來源：訂單備註 · 對外可見</p>
          </div>
        </details>

        <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />查看收件資訊</span>
            <span className="text-xs text-muted-foreground">{logistics.contactName}</span>
          </summary>
          <div className="grid gap-x-6 gap-y-3 border-t px-4 py-3 sm:grid-cols-2">
            <PanelRow label="物流" value={logistics.carrierLabel} />
            <PanelRow label="收件人" value={logistics.contactName} />
            {logistics.phone !== '—' ? <PanelRow label="電話" value={logistics.phone} /> : null}
            <PanelRow label="寄送地" value={logistics.destination} />
            {data.order ? <PanelRow label="付款" value={paymentStatusLabel[data.order.paymentStatus] ?? data.order.paymentStatus} /> : null}
            {data.order ? <PanelRow label="運費" value={data.fulfillmentFeeLabel ?? data.order.shippingFeeType} /> : null}
          </div>
        </details>

        {data.internalNotes ? (
          <details className="group rounded-lg border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
              <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" />查看內部備註</span>
              <span className="text-xs text-muted-foreground">僅團隊可見</span>
            </summary>
            <div className="whitespace-pre-line border-t px-4 py-3 text-sm text-muted-foreground">{data.internalNotes}</div>
          </details>
        ) : null}

        {!quickActionReady && allowedNext.length > 0 ? (
          <details className="group rounded-lg border bg-card">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">補充出貨資料</summary>
            <div className="border-t p-3">
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
                queueType={queueType}
              />
            </div>
          </details>
        ) : null}
      </div>

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
