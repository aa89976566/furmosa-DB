'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import { paymentStatusLabel, shippingFeeTypeLabel } from '@/lib/labels';
import { formatPlanContents } from '@/lib/plan-contents';
import { resolveLogisticsFromShipment } from '@/lib/logistics-display';
import { resolveShipActionCarrierDefaults } from '@/lib/merchant-shipping-defaults';
import {
  formatPanelUpdatedAt,
  isShipmentSnapshotStale,
  resolveShipmentProducts,
} from '@/lib/shipment-queue-products';
import {
  nextStatuses,
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
  type ShipmentStatus,
} from '@/lib/shipment';
import { Loader2, MapPin, Package, Phone, RefreshCw, Truck } from 'lucide-react';

export function ShipmentOrderPanel({
  shipmentId,
  queueStatus,
  listSnapshotStatus,
  orderLabel,
  onMutated,
}: {
  shipmentId: string;
  queueStatus?: string;
  listSnapshotStatus?: string | null;
  orderLabel?: string;
  onMutated?: () => void;
}) {
  const [data, setData] = useState<ShipmentPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [openedSnapshot, setOpenedSnapshot] = useState<string | null>(
    listSnapshotStatus ?? null,
  );
  const [retryToken, setRetryToken] = useState(0);

  const load = useCallback(async (opts?: { acceptServerStatus?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const panel = await fetchShipmentPanel(shipmentId);
      if (!panel) {
        setError('找不到這張出貨單');
        setData(null);
        return;
      }
      setData(panel);
      setFetchedAt(new Date());
      if (opts?.acceptServerStatus) {
        // 使用者主動重新整理後，接受伺服器狀態並解除寫入鎖定
        setOpenedSnapshot(panel.status);
      } else if (openedSnapshot == null) {
        setOpenedSnapshot(listSnapshotStatus ?? panel.status);
      }
    } catch {
      setError('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, [shipmentId, listSnapshotStatus, openedSnapshot]);

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
        setFetchedAt(new Date());
        setOpenedSnapshot((prev) => prev ?? listSnapshotStatus ?? panel.status);
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
  }, [shipmentId, retryToken, listSnapshotStatus]);

  if (loading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="載入出貨內容"
        data-shipment-panel-state="loading"
      >
        <div className="h-20 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-40 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-28 animate-pulse rounded-lg bg-muted/40" />
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          載入出貨內容…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
        data-shipment-panel-state="error"
        role="alert"
      >
        <p className="text-sm font-medium text-destructive">{error ?? '找不到這張出貨單'}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setRetryToken((value) => value + 1)}
          aria-label={`重試載入出貨單 ${orderLabel ?? shipmentId}`}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          重試
        </Button>
      </div>
    );
  }

  const stale = isShipmentSnapshotStale(openedSnapshot, data.status);
  const allowedNext = stale ? ([] as ShipmentStatus[]) : (nextStatuses(data.status) as ShipmentStatus[]);
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
  const productSummary = resolveShipmentProducts({
    type: data.type,
    items: data.items,
    planContents: data.subscription?.planContents,
    campaignProduct: data.campaignProduct ?? null,
    orderItems: data.orderItems ?? null,
  });
  const labelForAria =
    orderLabel ?? data.order?.orderNumber ?? data.shipmentNumber;

  return (
    <div className="min-w-0 space-y-6" data-shipment-panel-state="ready">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-card p-4">
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
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{fetchedAt ? formatPanelUpdatedAt(fetchedAt) : null}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs"
            onClick={() => {
              void load({ acceptServerStatus: true }).then(() => onMutated?.());
            }}
            aria-label={`重新整理出貨單 ${labelForAria}`}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            重新整理
          </Button>
        </div>
      </div>

      {stale ? (
        <div
          className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-amber-900"
          role="status"
          data-shipment-stale="true"
        >
          資料已由其他人更新，請重新整理
        </div>
      ) : null}

      {/* 1. 出貨品項 */}
      <section className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4 shrink-0 text-info" />
          出貨品項
          {productSummary.state === 'ok' ? (
            <span className="text-xs font-normal text-muted-foreground">
              {productSummary.itemCount} 項 · 共 {productSummary.totalQty} 件
            </span>
          ) : null}
        </h3>
        {data.subscription && productSummary.lines.every((line) => line.source === 'plan') ? (
          <p className="mt-2 text-xs text-muted-foreground">
            訂閱方案：{data.subscription.planName ?? '未命名方案'}
            {data.subscription.planContents.length > 0
              ? ` · ${formatPlanContents(data.subscription.planContents)}`
              : ''}
          </p>
        ) : null}
        {productSummary.state === 'anomaly' ? (
          <p className="mt-4 text-sm font-medium text-destructive" role="status">
            {productSummary.message}
          </p>
        ) : productSummary.state === 'empty' ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {productSummary.message}
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-2 md:hidden">
              {productSummary.lines.map((item) => (
                <li
                  key={item.key}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium break-words [overflow-wrap:anywhere]">{item.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{item.sku ?? '-'}</span>
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
                {productSummary.lines.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.sku ?? '-'}
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
          </>
        )}
      </section>

      {/* 2. 收件／目的地 */}
      <section className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 shrink-0 text-info" />
          收件／目的地
        </h3>
        <dl className="mt-4 space-y-3 text-sm">
          <PanelRow label="收件人" value={logistics.contactName} />
          {logistics.phone !== '—' ? (
            <PanelRow
              label="電話"
              value={
                <a
                  href={`tel:${logistics.phone.replace(/\s/g, '')}`}
                  data-stop-row-open="true"
                  className="inline-flex items-center gap-1 font-mono"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {logistics.phone}
                </a>
              }
            />
          ) : null}
          <PanelRow
            label="寄送地"
            value={
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                {logistics.destination}
              </span>
            }
          />
        </dl>
      </section>

      {/* 3. 付款摘要 */}
      <section className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
        <h3 className="text-sm font-semibold">付款摘要</h3>
        {data.order ? (
          <dl className="mt-4 space-y-3 text-sm">
            <PanelRow
              label="付款"
              value={paymentStatusLabel[data.order.paymentStatus] ?? data.order.paymentStatus}
            />
            <PanelRow
              label="運費"
              value={
                shippingFeeTypeLabel[data.order.shippingFeeType] ?? data.order.shippingFeeType
              }
            />
            <PanelRow label="運費金額" value={`$${data.order.shippingFee}`} />
            <PanelRow label="訂單合計" value={`$${data.order.total}`} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">此出貨單無關聯訂單付款資料</p>
        )}
      </section>

      {/* 4. 物流／追蹤／狀態 */}
      <section className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="h-4 w-4 shrink-0 text-info" />
          物流／追蹤
        </h3>
        <dl className="mt-4 space-y-3 text-sm">
          <PanelRow label="物流" value={logistics.carrierLabel} />
          <PanelRow
            label="狀態"
            value={shipmentStatusLabel[data.status] ?? data.status}
          />
          <PanelRow
            label="追蹤碼"
            value={
              data.trackingNumber ? (
                <button
                  type="button"
                  data-stop-row-open="true"
                  className="font-mono text-sm underline-offset-2 hover:underline"
                  aria-label={`複製追蹤碼 ${data.trackingNumber}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void navigator.clipboard?.writeText(data.trackingNumber ?? '');
                  }}
                >
                  {data.trackingNumber}
                </button>
              ) : (
                '尚未填寫'
              )
            }
          />
        </dl>
      </section>

      {/* 5. 寫入操作區（與唯讀區清楚分隔；Drawer 內單欄） */}
      <section
        className="min-w-0 rounded-xl border border-border/80 bg-muted/20 p-4"
        data-shipment-write-section="true"
        aria-label={`出貨操作 ${labelForAria}`}
      >
        <h3 className="text-sm font-semibold">出貨操作</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          寄出時請填寫物流商與追蹤碼；客戶訂單會一併更新。
        </p>
        {stale ? (
          <p className="mt-5 text-sm text-amber-900">
            狀態已變更，請先重新整理後再操作。
          </p>
        ) : (
          <div
            className="mt-5 w-full min-w-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
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
              orderLabel={labelForAria}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground sm:w-16">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium break-words [overflow-wrap:anywhere] sm:text-right">
        {value}
      </dd>
    </div>
  );
}
