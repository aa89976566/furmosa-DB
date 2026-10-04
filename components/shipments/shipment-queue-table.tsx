'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShipmentQueueStatusCell } from '@/components/shipments/shipment-queue-status-select';
import { formatDate, formatRelative } from '@/lib/format';
import { resolveLogisticsFromShipment } from '@/lib/logistics-display';
import { productLabel } from '@/lib/product-label';
import { parsePlanContents } from '@/lib/plan-contents';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VirtualCardList } from '@/components/shared/virtualized-rows';
import { shipmentTypeLabel } from '@/lib/shipment';
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import { CalendarClock, ChevronRight, MapPin, PackageCheck, Phone, Truck } from 'lucide-react';
import Link from 'next/link';
import {
  isOmsShipmentActionable,
  omsStatusLabel,
  type OmsStatus,
} from '@/lib/orders/oms';

export type ShipmentQueueRow = {
  id: string;
  shipmentNumber: string;
  type: string;
  status: string;
  createdAt: Date | string;
  carrier: string | null;
  trackingNumber: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  merchant: {
    id: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    preferredCarrier?: string | null;
    pickupStoreName?: string | null;
  } | null;
  customer: { id: string; name: string } | null;
  order: {
    id: string;
    orderNumber: string;
    displayOrderNumber: string;
    omsStatus: OmsStatus | null;
    status: string;
    paymentStatus: string;
    shippingFeeType?: string;
    shippingMethod: string;
    cvsBrand: string | null;
    cvsStoreId: string | null;
    cvsStoreName: string | null;
  } | null;
  fulfillmentFeeLabel?: string | null;
  paymentReviewHold?: boolean;
  inventoryWarnings?: string[];
  items: Array<{
    productName: string;
    weightGrams: number | null;
    quantity: number;
  }>;
  subscriptionShipment: {
    shipmentNo: string;
    scheduledDate: Date | string | null;
    subscription: {
      subscriptionNo: string;
      plan: { name: string; contents: string | null } | null;
    } | null;
  } | null;
};

function ShipmentStatusControl({
  shipment,
  queueStatus,
  queueType,
  onOptimisticChange,
}: {
  shipment: ShipmentQueueRow;
  queueStatus?: string;
  queueType?: string;
  onOptimisticChange?: (
    phase: 'start' | 'success' | 'error',
    message?: string,
  ) => void;
}) {
  const omsStatus = shipment.order?.omsStatus;
  if (omsStatus && !isOmsShipmentActionable(omsStatus)) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-amber-800">
          OMS：{omsStatusLabel(omsStatus)}
        </p>
        <Link
          href={`/orders/${shipment.order!.id}#oms-review`}
          className="inline-flex min-h-9 items-center rounded-lg border border-border bg-background px-3 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          前往訂單審核
        </Link>
      </div>
    );
  }

  return (
    <ShipmentQueueStatusCell
      shipmentId={shipment.id}
      status={shipment.status}
      queueStatus={queueStatus}
      queueType={queueType}
      shipmentType={shipment.type}
      paymentReviewHold={Boolean(shipment.paymentReviewHold)}
      inventoryWarnings={shipment.inventoryWarnings}
      className="max-w-none"
      onOptimisticChange={onOptimisticChange}
    />
  );
}

type QueueRowView = {
  shipment: ShipmentQueueRow;
  orderLabel: string;
  partyLabel: string;
  shortNumber: string;
  logistics: ReturnType<typeof resolveLogisticsFromShipment>;
  productLines: string[];
  totalQty: number;
  isSub: boolean;
  planName: string;
  scheduledDate: Date | string | null;
  itemCountLabel: string;
};

function shortShipmentNumber(value: string) {
  const segment = value.split('-').pop();
  if (segment && segment.length <= 10) return segment;
  return value.length > 10 ? value.slice(-10) : value;
}

function rowLabel(s: ShipmentQueueRow) {
  return (
    s.order?.orderNumber ||
    s.order?.displayOrderNumber ||
    s.subscriptionShipment?.subscription?.subscriptionNo ||
    s.subscriptionShipment?.shipmentNo ||
    s.shipmentNumber
  );
}

function partyLabel(s: ShipmentQueueRow) {
  if (s.type === 'merchant_restock') {
    return s.merchant?.name.trim() || s.recipientName?.trim() || '店家未設定';
  }
  return s.recipientName?.trim() || s.customer?.name.trim() || '姓名未設定';
}

function buildQueueRowView(s: ShipmentQueueRow): QueueRowView {
  const totalQty = s.items.reduce((sum, i) => sum + i.quantity, 0);
  const isSub = s.type === 'subscription';
  const planContents = isSub
    ? parsePlanContents(s.subscriptionShipment?.subscription?.plan?.contents)
    : [];
  const logistics = resolveLogisticsFromShipment({
    type: s.type,
    carrier: s.carrier,
    recipientName: s.recipientName,
    recipientPhone: s.recipientPhone,
    recipientAddress: s.recipientAddress,
    merchant: s.merchant,
    order: s.order,
  });
  const scheduledDate = s.subscriptionShipment?.scheduledDate ?? null;
  const planName = s.subscriptionShipment?.subscription?.plan?.name ?? '訂閱方案';
  const productLines =
    isSub && planContents.length > 0
      ? planContents.map((item) => (item.weight ? `${item.name}（${item.weight}）` : item.name))
      : s.items.map((item) =>
          `${productLabel(item.productName, item.weightGrams)} ×${item.quantity}`,
        );
  const itemTotal = isSub ? productLines.length : totalQty;

  return {
    shipment: s,
    orderLabel: rowLabel(s),
    partyLabel: partyLabel(s),
    shortNumber: shortShipmentNumber(s.shipmentNumber),
    logistics,
    productLines,
    totalQty,
    isSub,
    planName,
    scheduledDate,
    itemCountLabel: `${productLines.length} 項 · 共 ${itemTotal} 件`,
  };
}

function LogisticsBlock({
  view,
  variant,
}: {
  view: QueueRowView;
  variant: 'default' | 'subscription';
}) {
  const { logistics, scheduledDate } = view;

  return (
    <div className="space-y-1">
      {variant === 'subscription' && scheduledDate ? (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] font-medium text-info">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>預定 {formatDate(scheduledDate)}</span>
          <span className="text-muted-foreground">· {formatRelative(scheduledDate)}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-1 text-[11px] font-medium text-info">
        <Truck className="h-3.5 w-3.5 shrink-0" />
        <span>{logistics.carrierLabel}</span>
      </div>
      <div className="flex items-start gap-1.5 text-sm font-medium leading-snug text-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{logistics.destination}</span>
      </div>
    </div>
  );
}

function ProductsSummary({ view }: { view: QueueRowView }) {
  if (view.productLines.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
          {view.itemCountLabel}
        </span>
        {view.isSub ? (
          <span className="inline-flex items-center rounded-md bg-violet-500/12 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            {view.planName}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {view.productLines.slice(0, 2).join('、')}
        {view.productLines.length > 2 ? `，另 ${view.productLines.length - 2} 項` : ''}
      </p>
    </div>
  );
}

function EmptyQueueState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PackageCheck className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">目前沒有待處理的出貨單</p>
        <p className="text-xs text-muted-foreground">可切換上方其他出貨階段繼續工作。</p>
      </div>
    </div>
  );
}

function ShipmentQueueCard({
  view,
  variant,
  selected,
  queueStatus,
  queueType,
  onSelect,
  onOptimisticChange,
}: {
  view: QueueRowView;
  variant: 'default' | 'subscription';
  selected: boolean;
  queueStatus?: string;
  queueType?: string;
  onSelect: () => void;
  onOptimisticChange?: (
    phase: 'start' | 'success' | 'error',
    message?: string,
  ) => void;
}) {
  const { shipment, orderLabel, partyLabel, shortNumber, logistics } = view;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative w-full cursor-pointer rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors',
        'active:bg-muted/40',
        selected && 'border-primary/30 bg-primary/[0.06] ring-1 ring-primary/20',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary transition-opacity',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{orderLabel}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {shipmentTypeLabel[shipment.type] ?? shipment.type}
            </Badge>
            {shipment.fulfillmentFeeLabel ? (
              <Badge
                variant={shipment.paymentReviewHold ? 'warning' : 'outline'}
                className="h-5 px-1.5 text-[10px] font-normal"
              >
                {shipment.fulfillmentFeeLabel}
              </Badge>
            ) : shipment.paymentReviewHold ? (
              <Badge variant="warning" className="h-5 px-1.5 text-[10px] font-normal">
                {JIBA_PAYMENT_REVIEW_LABEL}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{partyLabel}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            出貨單 {shortNumber}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" />
      </div>

      {view.productLines.length > 0 ? (
        <div className="mt-3">
          <ProductsSummary view={view} />
        </div>
      ) : null}

      <div className="mt-3 border-t border-border/60 pt-3">
        <LogisticsBlock view={view} variant={variant} />
      </div>

      {/* 高頻物流動作固定放卡片底部，詳細電話與地址點卡片再看。 */}
      <div
        className="mt-3"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ShipmentStatusControl
          shipment={shipment}
          queueStatus={queueStatus}
          queueType={queueType}
          onOptimisticChange={onOptimisticChange}
        />
      </div>
    </div>
  );
}

export function ShipmentQueueTable({
  shipments,
  onSelectShipment,
  selectedShipmentId,
  queueStatus,
  queueType,
  variant = 'default',
}: {
  shipments: ShipmentQueueRow[];
  onSelectShipment: (shipment: ShipmentQueueRow) => void;
  selectedShipmentId?: string | null;
  queueStatus?: string;
  queueType?: string;
  variant?: 'default' | 'subscription';
}) {
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null);

  useEffect(() => {
    const visibleIds = new Set(shipments.map((shipment) => shipment.id));
    setOptimisticHidden((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [shipments]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const views = useMemo(
    () =>
      shipments
        .filter((shipment) => !optimisticHidden.has(shipment.id))
        .map(buildQueueRowView),
    [optimisticHidden, shipments],
  );

  function optimisticHandler(shipmentId: string) {
    return (phase: 'start' | 'success' | 'error', message?: string) => {
      if (phase === 'start') {
        setOptimisticHidden((current) => new Set(current).add(shipmentId));
        setNotice({ kind: 'success', text: '正在標記寄出…' });
        return;
      }
      if (phase === 'success') {
        setNotice({ kind: 'success', text: '已標記寄出 · 已移到運送中' });
        return;
      }
      setOptimisticHidden((current) => {
        const next = new Set(current);
        next.delete(shipmentId);
        return next;
      });
      setNotice({ kind: 'error', text: message ?? '更新出貨狀態失敗' });
    };
  }

  if (views.length === 0 && shipments.length === 0) {
    return <EmptyQueueState />;
  }

  return (
    <>
      <div className="md:hidden">
        <VirtualCardList
          items={views}
          estimateSize={320}
          getKey={(view) => view.shipment.id}
          renderItem={(view) => (
            <ShipmentQueueCard
              view={view}
              variant={variant}
              selected={selectedShipmentId === view.shipment.id}
              queueStatus={queueStatus}
              queueType={queueType}
              onSelect={() => onSelectShipment(view.shipment)}
              onOptimisticChange={optimisticHandler(view.shipment.id)}
            />
          )}
        />
      </div>

      <div className="hidden max-h-[36rem] overflow-auto rounded-xl border border-border/70 md:block">
        <Table className="min-w-[56rem] table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[16rem]">訂單</TableHead>
              <TableHead>商品</TableHead>
              <TableHead className="w-[20rem]">配送</TableHead>
              <TableHead className="w-[13rem]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((view) => {
              const { shipment, orderLabel, partyLabel, shortNumber, logistics } = view;

              return (
                <TableRow
                  key={shipment.id}
                  className={cn(
                    'relative cursor-pointer align-top transition-colors hover:bg-muted/40',
                    selectedShipmentId === shipment.id &&
                      'bg-primary/[0.06] hover:bg-primary/[0.06]',
                  )}
                  onClick={() => onSelectShipment(shipment)}
                  title={`${orderLabel} · ${partyLabel}`}
                >
                  <TableCell
                    className={cn(
                      'relative py-3',
                      selectedShipmentId === shipment.id &&
                        'after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-primary',
                    )}
                  >
                    <span
                      className="block font-mono text-xs font-semibold leading-tight text-foreground"
                      title={orderLabel}
                    >
                      {orderLabel}
                    </span>
                    <p className="mt-1 text-sm font-medium text-foreground">{partyLabel}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                        {shipmentTypeLabel[shipment.type] ?? shipment.type}
                      </Badge>
                      {shipment.fulfillmentFeeLabel ? (
                        <Badge
                          variant={shipment.paymentReviewHold ? 'warning' : 'outline'}
                          className="h-4 px-1 text-[9px] font-normal"
                        >
                          {shipment.fulfillmentFeeLabel}
                        </Badge>
                      ) : shipment.paymentReviewHold ? (
                        <Badge variant="warning" className="h-4 px-1 text-[9px] font-normal">
                          {JIBA_PAYMENT_REVIEW_LABEL}
                        </Badge>
                      ) : null}
                      <span className="font-mono text-[10px] text-muted-foreground">SHP {shortNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <ProductsSummary view={view} />
                  </TableCell>
                  <TableCell className="py-3">
                    <LogisticsBlock view={view} variant={variant} />
                    {logistics.phone && logistics.phone !== '—' ? (
                      <div className="mt-2 flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="whitespace-nowrap">{logistics.phone}</span>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className="py-3"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <ShipmentStatusControl
                      shipment={shipment}
                      queueStatus={queueStatus}
                      queueType={queueType}
                      onOptimisticChange={optimisticHandler(shipment.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {notice ? (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'fixed bottom-4 left-1/2 z-[90] w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-lg',
            notice.kind === 'error'
              ? 'border-destructive/30 bg-background text-destructive'
              : 'border-foreground bg-foreground text-background',
          )}
        >
          {notice.text}
        </div>
      ) : null}
    </>
  );
}
