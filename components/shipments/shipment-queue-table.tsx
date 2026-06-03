'use client';

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
import { shipmentTypeLabel } from '@/lib/shipment';
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

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[7.5rem]">單號</TableHead>
          <TableHead className="w-[6.5rem]">運輸狀態</TableHead>
          <TableHead className="w-[30%]">寄送地</TableHead>
          <TableHead className="w-[11rem] min-w-[11rem]">電話</TableHead>
          <TableHead>商品 · 件數</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((s) => {
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
              ? planContents.map((item) =>
                  item.weight ? `${item.name}（${item.weight}）` : item.name,
                )
              : s.items.map((item) =>
                  `${productLabel(item.productName, item.weightGrams)} ×${item.quantity}`,
                );

          return (
            <TableRow
              key={s.id}
              className={cn(
                'relative cursor-pointer align-top transition-colors hover:bg-muted/40',
                'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:opacity-0 before:transition-opacity',
                selectedShipmentId === s.id &&
                  'bg-primary/[0.06] before:opacity-100 hover:bg-primary/[0.06]',
              )}
              onClick={() => onSelectShipment(s)}
              title={`${rowLabel(s)} · ${s.shipmentNumber}`}
            >
              <TableCell className="py-3">
                <span
                  className="block font-mono text-[11px] font-semibold leading-tight text-foreground"
                  title={s.shipmentNumber}
                >
                  {rowLabel(s)}
                </span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                    {shipmentTypeLabel[s.type] ?? s.type}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {shortShipmentNumber(s.shipmentNumber)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="py-3" onClick={(event) => event.stopPropagation()}>
                <ShipmentQueueStatusCell
                  shipmentId={s.id}
                  status={s.status}
                  queueStatus={queueStatus}
                  queueType={queueType}
                />
              </TableCell>
              <TableCell className="py-3">
                <div className="space-y-1">
                  {variant === 'subscription' && scheduledDate ? (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-info">
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
                    <span className="break-words [overflow-wrap:anywhere]">
                      {logistics.destination}
                    </span>
                  </div>
                  <div className="pl-5 text-xs text-muted-foreground">
                    {logistics.contactName}
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap py-3">
                {logistics.phone && logistics.phone !== '—' ? (
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="whitespace-nowrap">{logistics.phone}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="py-3">
                {productLines.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                        {productLines.length} 項 · 共 {isSub ? productLines.length : totalQty} 件
                      </span>
                      {isSub ? (
                        <span className="inline-flex items-center rounded-md bg-violet-500/12 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                          {planName}
                        </span>
                      ) : null}
                    </div>
                    <ItemBulletList items={productLines} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
