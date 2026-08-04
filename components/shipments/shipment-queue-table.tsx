'use client';

import {
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
  /** 單號欄：訂單號／訂閱號／出貨單號（不再用店名充當單號） */
  docNumber: string;
  shortNumber: string;
  /** 對象：顧客／收件人／店家 */
  party: string;
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

/** 單號：優先訂單／訂閱編號，避免寄賣單把店名塞進單號欄 */
function docNumber(s: ShipmentQueueRow) {
  return (
    s.order?.orderNumber ??
    s.subscriptionShipment?.subscription?.subscriptionNo ??
    s.subscriptionShipment?.shipmentNo ??
    s.shipmentNumber
  );
}

/** 對象：顧客 → 收件人 → 店家聯絡人 → 店名 */
function partyName(s: ShipmentQueueRow) {
  const recipient = s.recipientName?.trim();
  if (s.customer?.name) return s.customer.name;
  if (recipient) return recipient;
  if (s.type === 'merchant_restock' && s.merchant?.name) {
    return s.merchant.contactName?.trim()
      ? `${s.merchant.name}（${s.merchant.contactName.trim()}）`
      : s.merchant.name;
  }
  if (s.merchant?.name) return s.merchant.name;
  return '未指定對象';
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
    docNumber: docNumber(s),
    shortNumber: shortShipmentNumber(s.shipmentNumber),
    party: partyName(s),
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
    <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
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
    <div className="min-w-[10rem] space-y-1">
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

function ProductsBlock({ view }: { view: QueueRowView }) {
  if (view.productLines.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="min-w-[14rem] max-w-md space-y-1.5">
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

function ShipmentQueueCard({
  view,
  variant,
  selected,
  queueStatus,
  queueType,
  onSelect,
}: {
  view: QueueRowView;
  variant: 'default' | 'subscription';
  selected: boolean;
  queueStatus?: string;
  queueType?: string;
  onSelect: () => void;
}) {
  const { shipment, docNumber: number, shortNumber, party, logistics } = view;
  const unnamed = party === '未指定對象';

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
            <span className="font-mono text-sm font-semibold text-foreground">{number}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {shipmentTypeLabel[shipment.type] ?? shipment.type}
            </Badge>
          </div>
          <p
            className={cn(
              'mt-0.5 truncate text-sm',
              unnamed ? 'text-muted-foreground' : 'font-medium text-foreground',
            )}
          >
            {party}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{shortNumber}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" />
      </div>

      <div
        className="mt-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          運輸狀態
        </p>
        <ShipmentQueueStatusCell
          shipmentId={shipment.id}
          status={shipment.status}
          queueStatus={queueStatus}
          queueType={queueType}
          className="max-w-none"
        />
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
  if (shipments.length === 0) {
    return <EmptyQueueState />;
  }

  const views = shipments.map(buildQueueRowView);

  return (
    <>
      {/* 窄屏／側欄擠壓：用卡片，避免表格欄被壓成中文直排 */}
      <div className="lg:hidden">
        <VirtualCardList
          items={views}
          estimateSize={200}
          getKey={(view) => view.shipment.id}
          renderItem={(view) => (
            <ShipmentQueueCard
              view={view}
              variant={variant}
              selected={selectedShipmentId === view.shipment.id}
              queueStatus={queueStatus}
              queueType={queueType}
              onSelect={() => onSelectShipment(view.shipment)}
            />
          )}
        />
      </div>

      <div className="hidden max-h-[36rem] overflow-auto rounded-xl border border-border/70 lg:block">
        {/* 單一捲動層，避免 Table 元件雙層 overflow 造成表頭／欄位錯位 */}
        <table className="min-w-[68rem] w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[10rem] whitespace-nowrap">單號</TableHead>
              <TableHead className="min-w-[9rem] whitespace-nowrap">對象</TableHead>
              <TableHead className="min-w-[12.5rem] whitespace-nowrap">運輸狀態</TableHead>
              <TableHead className="min-w-[12rem] whitespace-nowrap">寄送地</TableHead>
              <TableHead className="min-w-[8rem] whitespace-nowrap">電話</TableHead>
              <TableHead className="min-w-[16rem] whitespace-nowrap">商品 · 件數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((view) => {
              const { shipment, docNumber: number, shortNumber, party, logistics } = view;
              const unnamed = party === '未指定對象';

              return (
                <TableRow
                  key={shipment.id}
                  className={cn(
                    'cursor-pointer align-top transition-colors hover:bg-muted/40',
                    selectedShipmentId === shipment.id &&
                      'bg-primary/[0.06] hover:bg-primary/[0.06]',
                  )}
                  onClick={() => onSelectShipment(shipment)}
                  title={`${number} · ${party} · ${shipment.shipmentNumber}`}
                >
                  <TableCell className="relative py-3 pl-4">
                    {/* 選取指示線放在 td 內，不可用 tr::before（會多出一欄導致整列錯位） */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-2 left-0 w-0.5 rounded-full bg-ink transition-opacity',
                        selectedShipmentId === shipment.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span
                      className="block font-mono text-[11px] font-semibold leading-tight text-foreground"
                      title={shipment.shipmentNumber}
                    >
                      {number}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                        {shipmentTypeLabel[shipment.type] ?? shipment.type}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {shortNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <p
                      className={cn(
                        'text-sm font-medium leading-snug break-words [overflow-wrap:anywhere]',
                        unnamed ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {party}
                    </p>
                  </TableCell>
                  <TableCell className="py-3" onClick={(event) => event.stopPropagation()}>
                    <ShipmentQueueStatusCell
                      shipmentId={shipment.id}
                      status={shipment.status}
                      queueStatus={queueStatus}
                      queueType={queueType}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <LogisticsBlock view={view} variant={variant} />
                  </TableCell>
                  <TableCell className="py-3">
                    {logistics.phone && logistics.phone !== '—' ? (
                      <div className="flex min-w-[7rem] items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
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
        </table>
      </div>
    </>
  );
}
