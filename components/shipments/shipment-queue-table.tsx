'use client';

import { useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShipmentProductSummary } from '@/components/shipments/shipment-product-summary';
import { formatDate, formatRelative } from '@/lib/format';
import { orderSourceLabel } from '@/lib/labels';
import { resolveLogisticsFromShipment } from '@/lib/logistics-display';
import { parsePlanContents } from '@/lib/plan-contents';
import {
  resolveShipmentProducts,
  shouldOpenShipmentDrawerFromTarget,
  type ProductSummaryModel,
} from '@/lib/shipment-queue-products';
import {
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
} from '@/lib/shipment';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VirtualCardList } from '@/components/shared/virtualized-rows';
import { CalendarClock, MapPin, PackageCheck, Phone, Truck } from 'lucide-react';

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
    source?: string | null;
    shippingMethod: string;
    cvsBrand: string | null;
    cvsStoreId: string | null;
    cvsStoreName: string | null;
  } | null;
  items: Array<{
    id?: string;
    productName: string;
    weightGrams: number | null;
    quantity: number;
    sku?: string | null;
    unit?: string | null;
  }>;
  /** 活動零價贈品（唯讀 fallback，由 list mapper 填入） */
  campaignProduct?: {
    productName: string;
    quantity: number;
    unit?: string | null;
    sku?: string | null;
  } | null;
  subscriptionShipment: {
    shipmentNo: string;
    scheduledDate: Date | string | null;
    subscription: {
      subscriptionNo: string;
      plan: { name: string; contents: string | null } | null;
    } | null;
  } | null;
};

type QueueRowView = {
  shipment: ShipmentQueueRow;
  label: string;
  shortNumber: string;
  sourceLabel: string;
  logistics: ReturnType<typeof resolveLogisticsFromShipment>;
  productSummary: ProductSummaryModel;
  isSub: boolean;
  planName: string;
  scheduledDate: Date | string | null;
};

function shortShipmentNumber(value: string) {
  const segment = value.split('-').pop();
  if (segment && segment.length <= 10) return segment;
  return value.length > 10 ? value.slice(-10) : value;
}

function rowLabel(s: ShipmentQueueRow) {
  if (s.type === 'merchant_restock' && s.merchant?.name) {
    return s.merchant.name;
  }
  return (
    s.order?.orderNumber ??
    s.subscriptionShipment?.subscription?.subscriptionNo ??
    s.subscriptionShipment?.shipmentNo ??
    s.shipmentNumber
  );
}

export function buildQueueRowView(s: ShipmentQueueRow): QueueRowView {
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
  const source =
    s.order?.source
      ? (orderSourceLabel[s.order.source] ?? s.order.source)
      : (shipmentTypeLabel[s.type] ?? s.type);
  const productSummary = resolveShipmentProducts({
    type: s.type,
    items: s.items,
    planContents,
    campaignProduct: s.campaignProduct ?? null,
  });

  return {
    shipment: s,
    label: rowLabel(s),
    shortNumber: shortShipmentNumber(s.shipmentNumber),
    sourceLabel: source,
    logistics,
    productSummary,
    isSub,
    planName,
    scheduledDate,
  };
}

function LogisticsCompact({
  view,
  variant,
}: {
  view: QueueRowView;
  variant: 'default' | 'subscription';
}) {
  const { logistics, scheduledDate } = view;

  return (
    <div className="min-w-0 space-y-0.5">
      {variant === 'subscription' && scheduledDate ? (
        <div className="flex flex-wrap items-center gap-x-1 text-[11px] font-medium text-info">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>預定 {formatDate(scheduledDate)}</span>
          <span className="text-muted-foreground">· {formatRelative(scheduledDate)}</span>
        </div>
      ) : null}
      <div className="flex items-start gap-1.5 text-sm font-medium leading-snug text-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
        <span className="min-w-0 truncate" title={logistics.destination}>
          {logistics.destination}
        </span>
      </div>
      <div className="truncate pl-5 text-xs text-muted-foreground" title={logistics.contactName}>
        {logistics.contactName}
      </div>
      <div className="flex items-center gap-1 pl-5 text-[11px] text-muted-foreground">
        <Truck className="h-3 w-3 shrink-0" />
        <span className="truncate">{logistics.carrierLabel}</span>
      </div>
    </div>
  );
}

function EmptyQueueState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PackageCheck className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">此區沒有出貨單</p>
      <p className="text-xs text-muted-foreground">目前沒有待處理的項目</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={shipmentStatusVariant[status] ?? 'secondary'}
      className="h-6 whitespace-nowrap px-2 text-[11px]"
    >
      {shipmentStatusLabel[status] ?? status}
    </Badge>
  );
}

function ShipmentQueueCard({
  view,
  variant,
  selected,
  onSelect,
  rowRef,
}: {
  view: QueueRowView;
  variant: 'default' | 'subscription';
  selected: boolean;
  onSelect: (el: HTMLElement | null) => void;
  rowRef?: (el: HTMLElement | null) => void;
}) {
  const { shipment, label, shortNumber, sourceLabel, logistics } = view;
  const localRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={(el) => {
        localRef.current = el;
        rowRef?.(el);
      }}
      role="button"
      tabIndex={0}
      data-shipment-row={shipment.id}
      aria-label={`查看出貨單 ${label}`}
      onClick={(event) => {
        if (!shouldOpenShipmentDrawerFromTarget(event.target, event.currentTarget)) return;
        onSelect(localRef.current);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(localRef.current);
        }
      }}
      className={cn(
        'relative w-full cursor-pointer rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-colors',
        'active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
            <span className="font-mono text-sm font-semibold text-foreground">{label}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {sourceLabel}
            </Badge>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{shortNumber}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-shipment-open={shipment.id}
          aria-label={`查看訂單 ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(event.currentTarget);
          }}
        >
          查看
        </Button>
      </div>

      <div className="mt-3 rounded-xl bg-muted/30 px-3 py-2">
        <LogisticsCompact view={view} variant={variant} />
        {logistics.phone && logistics.phone !== '—' ? (
          <a
            href={`tel:${logistics.phone.replace(/\s/g, '')}`}
            data-stop-row-open="true"
            onClick={(event) => event.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-foreground"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {logistics.phone}
          </a>
        ) : null}
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        <ShipmentProductSummary model={view.productSummary} />
        {view.isSub ? (
          <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">{view.planName}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ShipmentQueueTable({
  shipments,
  onSelectShipment,
  selectedShipmentId,
  variant = 'default',
}: {
  shipments: ShipmentQueueRow[];
  onSelectShipment: (shipment: ShipmentQueueRow, triggerEl?: HTMLElement | null) => void;
  selectedShipmentId?: string | null;
  queueStatus?: string;
  queueType?: string;
  variant?: 'default' | 'subscription';
}) {
  if (shipments.length === 0) {
    return <EmptyQueueState />;
  }

  const views = shipments.map(buildQueueRowView);

  return (
    <>
      <div className="md:hidden">
        <VirtualCardList
          items={views}
          estimateSize={168}
          getKey={(view) => view.shipment.id}
          renderItem={(view) => (
            <ShipmentQueueCard
              view={view}
              variant={variant}
              selected={selectedShipmentId === view.shipment.id}
              onSelect={(el) => onSelectShipment(view.shipment, el)}
            />
          )}
        />
      </div>

      <div className="hidden max-h-[36rem] overflow-auto rounded-xl border border-border/70 md:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[9rem]">單號／來源</TableHead>
              <TableHead className="w-[5.5rem]">狀態</TableHead>
              <TableHead className="min-w-[10rem]">寄送地／收件</TableHead>
              <TableHead className="w-[8.5rem]">電話</TableHead>
              <TableHead className="min-w-[280px]">商品</TableHead>
              <TableHead className="w-[4.5rem] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((view) => {
              const { shipment, label, shortNumber, sourceLabel, logistics } = view;

              return (
                <TableRow
                  key={shipment.id}
                  data-shipment-row={shipment.id}
                  tabIndex={0}
                  aria-label={`查看出貨單 ${label}`}
                  className={cn(
                    'relative h-[68px] cursor-pointer align-middle transition-colors hover:bg-muted/40',
                    'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:opacity-0 before:transition-opacity',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    selectedShipmentId === shipment.id &&
                      'bg-primary/[0.06] before:opacity-100 hover:bg-primary/[0.06]',
                  )}
                  onClick={(event) => {
                    if (!shouldOpenShipmentDrawerFromTarget(event.target, event.currentTarget)) {
                      return;
                    }
                    onSelectShipment(shipment, event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectShipment(shipment, event.currentTarget);
                    }
                  }}
                  title={`${label} · ${shipment.shipmentNumber}`}
                >
                  <TableCell className="py-2.5">
                    <span
                      className="block truncate font-mono text-[11px] font-semibold leading-tight text-foreground"
                      title={shipment.shipmentNumber}
                    >
                      {label}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                        {sourceLabel}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {shortNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <StatusBadge status={shipment.status} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <LogisticsCompact view={view} variant={variant} />
                  </TableCell>
                  <TableCell className="py-2.5" data-stop-row-open="true">
                    {logistics.phone && logistics.phone !== '—' ? (
                      <a
                        href={`tel:${logistics.phone.replace(/\s/g, '')}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="break-all">{logistics.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">無電話</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <ShipmentProductSummary model={view.productSummary} />
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-shipment-open={shipment.id}
                      aria-label={`查看訂單 ${label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectShipment(shipment, event.currentTarget);
                      }}
                    >
                      查看
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
