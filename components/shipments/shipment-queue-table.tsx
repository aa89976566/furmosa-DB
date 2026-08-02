'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import { resolveLogisticsFromShipment } from '@/lib/logistics-display';
import { productLabel } from '@/lib/product-label';
import { parsePlanContents } from '@/lib/plan-contents';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VirtualCardList } from '@/components/shared/virtualized-rows';
import {
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
} from '@/lib/shipment';
import { CalendarClock, ChevronRight, MapPin, PackageCheck, Phone, Truck } from 'lucide-react';

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
    shippingMethod: string;
    cvsBrand: string | null;
    cvsStoreId: string | null;
    cvsStoreName: string | null;
  } | null;
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

type QueueRowView = {
  shipment: ShipmentQueueRow;
  label: string;
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
    label: rowLabel(s),
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

function ItemBulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="break-words [overflow-wrap:anywhere]">
          {item}
        </li>
      ))}
    </ul>
  );
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
      <div className="pl-5 text-xs text-muted-foreground">{logistics.contactName}</div>
    </div>
  );
}

function ProductsBlock({ view }: { view: QueueRowView }) {
  if (view.productLines.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1.5">
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
      <ItemBulletList items={view.productLines} />
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

function QueueStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={shipmentStatusVariant[status] ?? 'secondary'}
      className="h-5 px-1.5 text-[10px] font-medium"
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
}: {
  view: QueueRowView;
  variant: 'default' | 'subscription';
  selected: boolean;
  onSelect: () => void;
}) {
  const { shipment, label, shortNumber, logistics } = view;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'relative w-full cursor-pointer rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors',
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
              {shipmentTypeLabel[shipment.type] ?? shipment.type}
            </Badge>
            <QueueStatusBadge status={shipment.status} />
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{shortNumber}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" />
      </div>

      <div className="mt-3 rounded-xl bg-muted/30 px-3 py-2.5">
        <LogisticsBlock view={view} variant={variant} />
        {logistics.phone && logistics.phone !== '—' ? (
          <a
            href={`tel:${logistics.phone.replace(/\s/g, '')}`}
            onClick={(event) => event.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-foreground"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {logistics.phone}
          </a>
        ) : null}
      </div>

      {view.productLines.length > 0 ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <ProductsBlock view={view} />
        </div>
      ) : null}
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
  onSelectShipment: (shipment: ShipmentQueueRow) => void;
  selectedShipmentId?: string | null;
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
          estimateSize={132}
          getKey={(view) => view.shipment.id}
          renderItem={(view) => (
            <ShipmentQueueCard
              view={view}
              variant={variant}
              selected={selectedShipmentId === view.shipment.id}
              onSelect={() => onSelectShipment(view.shipment)}
            />
          )}
        />
      </div>

      <div className="hidden max-h-[36rem] overflow-auto rounded-xl border border-border/70 md:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[7.5rem]">單號</TableHead>
              <TableHead className="w-[5.5rem]">狀態</TableHead>
              <TableHead className="min-w-[12rem]">寄送地</TableHead>
              <TableHead className="w-[9rem]">電話</TableHead>
              <TableHead>商品 · 件數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((view) => {
              const { shipment, label, shortNumber, logistics } = view;

              return (
                <TableRow
                  key={shipment.id}
                  className={cn(
                    'relative cursor-pointer align-top transition-colors hover:bg-muted/40',
                    'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:opacity-0 before:transition-opacity',
                    selectedShipmentId === shipment.id &&
                      'bg-primary/[0.06] before:opacity-100 hover:bg-primary/[0.06]',
                  )}
                  onClick={() => onSelectShipment(shipment)}
                  title={`${label} · ${shipment.shipmentNumber}`}
                >
                  <TableCell className="py-3">
                    <span
                      className="block font-mono text-[11px] font-semibold leading-tight text-foreground"
                      title={shipment.shipmentNumber}
                    >
                      {label}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                        {shipmentTypeLabel[shipment.type] ?? shipment.type}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{shortNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <QueueStatusBadge status={shipment.status} />
                  </TableCell>
                  <TableCell className="py-3">
                    <LogisticsBlock view={view} variant={variant} />
                  </TableCell>
                  <TableCell className="py-3">
                    {logistics.phone && logistics.phone !== '—' ? (
                      <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="break-all">{logistics.phone}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <ProductsBlock view={view} />
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
