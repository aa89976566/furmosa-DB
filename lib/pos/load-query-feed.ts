import { prisma } from '@/lib/prisma';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';
import { formatQueryDate, formatQueryDateHeading, formatQueryMonthDay, formatQueryTime, formatQueryWhen, groupSaleLines, type QueryFeedItem, type RestockProgressStage } from '@/lib/pos/query-feed';

type RestockLine = {
  productName: string;
  quantity: number;
  unit?: string | null;
  weightGrams?: number | null;
};

export function cleanPosProductName(value: string): string {
  const cleaned = value
    .normalize('NFKC')
    .replace(/\uFFFD/g, '')
    .replace(/^[\s◇◆◈◊⋄|｜·•・]+|[\s◇◆◈◊⋄|｜·•・]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '商品';
}

function restockLineLabel(line: RestockLine): string {
  const name = cleanPosProductName(line.productName);
  if (!line.weightGrams || new RegExp(`(?:^|\\D)${line.weightGrams}\\s*g(?:$|\\D)`, 'i').test(name)) return name;
  return `${name} ${line.weightGrams}g`;
}

function restockLineQuantity(line: RestockLine): string {
  return `${line.quantity} ${line.unit?.trim() || '件'}`;
}

export function summarizeRestockLines(lines: RestockLine[]) {
  const items = lines.map((line) => ({ label: restockLineLabel(line), quantityLabel: restockLineQuantity(line) }));
  const summaryLabel = items.length === 0
    ? '品項待確認'
    : items.length === 1
      ? `${items[0]!.label} × ${items[0]!.quantityLabel}`
      : `${items[0]!.label} 等 ${items.length} 項`;
  return { items, summaryLabel };
}

function stockTypeLabel(type: string): string {
  switch (type) {
    case 'sale':
      return '銷售';
    case 'restock':
      return '收到貨';
    case 'return':
      return '退回';
    case 'adjust':
      return '盤點調整';
    default:
      return '庫存異動';
  }
}

export function restockFeedStatus(requestStatus: string, shipmentStatus?: string | null): string {
  if (requestStatus !== 'converted_to_shipment') {
    return ['submitted', 'under_review', 'approved'].includes(requestStatus)
      ? '尚未出貨'
      : restockStatusLabelForMerchant(requestStatus);
  }
  switch (shipmentStatus) {
    case 'shipped':
    case 'delivered':
      return '運送中';
    case 'received':
      return '店家已收貨';
    case 'cancelled':
      return '出貨已取消';
    default:
      return '尚未出貨';
  }
}

export function restockProgressStage(requestStatus: string, shipmentStatus?: string | null): RestockProgressStage {
  if (shipmentStatus === 'received') return 'received';
  if (shipmentStatus === 'cancelled' || requestStatus === 'rejected' || requestStatus === 'cancelled') return 'cancelled';
  if (shipmentStatus === 'shipped' || shipmentStatus === 'delivered') return 'in_transit';
  return 'not_shipped';
}

export function nextReceiptReminderDate(shippedAt: Date | null | undefined, now: Date): Date | null {
  if (!shippedAt) return null;
  const day3 = new Date(shippedAt.getTime() + 3 * 86400000);
  if (now < day3) return day3;
  const day5 = new Date(shippedAt.getTime() + 5 * 86400000);
  return now < day5 ? day5 : null;
}

export async function loadQueryFeed(merchantId: string): Promise<QueryFeedItem[]> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 60);

  const [sales, refills, restocks, directShipments, stockTxns] = await Promise.all([
    prisma.merchantStockTxn.findMany({
      where: { merchantId, type: 'sale', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        unitPrice: true,
        product: { select: { name: true } },
      },
    }),
    prisma.refillOrder.findMany({
      where: { merchantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        status: true,
        oldContainerSerial: true,
        newContainerSerial: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.restockRequest.findMany({
      where: { merchantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        expectedArrivalDate: true,
        status: true,
        shipment: { select: { status: true, shippedAt: true, receivedAt: true, updatedAt: true, items: { select: { productName: true, quantity: true, unit: true, weightGrams: true, product: { select: { name: true } } } } } },
        items: {
          select: {
            requestedQuantity: true,
            weightGrams: true,
            product: { select: { name: true, unit: true } },
          },
        },
      },
    }),
    prisma.shipment.findMany({
      where: { merchantId, type: 'merchant_restock', restockRequest: null, createdAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        shippedAt: true,
        receivedAt: true,
        items: { select: { productName: true, quantity: true, unit: true, weightGrams: true, product: { select: { name: true } } } },
      },
    }),
    prisma.merchantStockTxn.findMany({
      where: { merchantId, type: { notIn: ['sale', 'restock'] }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        createdAt: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        product: { select: { name: true, unit: true } },
      },
    }),
  ]);

  const saleItems = groupSaleLines(
    sales.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      productName: s.product?.name ?? '商品',
    })),
    now,
  );

  const refillItems: QueryFeedItem[] = refills.map((o) => {
    const oldCode = o.oldContainerSerial ? `#${o.oldContainerSerial}` : '舊罐';
    const newCode = o.newContainerSerial ? `#${o.newContainerSerial}` : '新罐';
    const subtitle = `${oldCode} → ${newCode}`;
    const status =
      o.status === 'completed'
        ? '已完成'
        : o.status === 'awaiting_extra_payment'
          ? '等待補差額'
          : o.status === 'payment_pending'
            ? '尚未付款'
            : '處理中';
    const at = o.createdAt.toISOString();
    return {
      id: `refill-${o.id}`,
      kind: 'refill',
      at,
      whenLabel: formatQueryWhen(at, now),
      dateLabel: formatQueryDateHeading(at),
      timeLabel: formatQueryTime(at),
      title: '換罐',
      subtitle,
      status,
      href: `/pos/refill/${o.id}`,
      searchText: `${o.customer.name} ${oldCode} ${newCode} ${o.oldContainerSerial ?? ''} ${o.newContainerSerial ?? ''}`.toLowerCase(),
    };
  });

  const restockItems: QueryFeedItem[] = restocks.map((r) => {
    const requestedLines: RestockLine[] = r.items.map((item) => ({
      productName: item.product.name,
      quantity: item.requestedQuantity ?? 0,
      unit: item.product.unit,
      weightGrams: item.weightGrams,
    }));
    const shipmentLines: RestockLine[] = r.shipment?.items.map((item) => ({
      productName: item.product?.name || item.productName,
      quantity: item.quantity,
      unit: item.unit,
      weightGrams: item.weightGrams,
    })) ?? [];
    const summary = summarizeRestockLines(shipmentLines.length ? shipmentLines : requestedLines);
    const occurredAt = r.shipment?.status === 'received'
      ? r.shipment.receivedAt ?? r.shipment.shippedAt ?? r.updatedAt
      : r.shipment?.status === 'shipped' || r.shipment?.status === 'delivered'
        ? r.shipment.shippedAt ?? r.shipment.updatedAt
        : r.shipment?.updatedAt ?? r.updatedAt ?? r.createdAt;
    const etaLabel = r.expectedArrivalDate
      ? `預計到貨 ${formatQueryDate(r.expectedArrivalDate.toISOString()).replace(/（.*）$/, '')}`
      : null;
    const subtitle = [etaLabel, summary.summaryLabel].filter(Boolean).join(' · ');
    const at = occurredAt.toISOString();
    const stage = restockProgressStage(r.status, r.shipment?.status);
    const reminderDate = stage === 'in_transit' ? nextReceiptReminderDate(r.shipment?.shippedAt, now) : null;
    return {
      id: `restock-${r.id}`,
      kind: 'restock',
      at,
      whenLabel: formatQueryWhen(at, now),
      dateLabel: formatQueryDateHeading(at),
      timeLabel: formatQueryTime(at),
      title: '匠寵補貨',
      subtitle,
      status: restockFeedStatus(r.status, r.shipment?.status),
      quantityLabel: restockFeedStatus(r.status, r.shipment?.status),
      restockProgress: {
        stage,
        statusLabel: restockFeedStatus(r.status, r.shipment?.status),
        summaryLabel: summary.summaryLabel,
        items: summary.items,
        shippedDateLabel: r.shipment?.shippedAt ? formatQueryMonthDay(r.shipment.shippedAt) : undefined,
        receivedDateLabel: r.shipment?.receivedAt ? formatQueryMonthDay(r.shipment.receivedAt) : undefined,
        reminderDateLabel: reminderDate ? formatQueryMonthDay(reminderDate) : undefined,
      },
      href: `/pos/restock/${r.id}`,
      searchText: `補貨 ${summary.items.map((item) => item.label).join(' ')} ${etaLabel ?? ''} ${restockFeedStatus(r.status, r.shipment?.status)} ${r.id}`.toLowerCase(),
    };
  });

  const directRestockItems: QueryFeedItem[] = directShipments.map((shipment) => {
    const summary = summarizeRestockLines(shipment.items.map((item) => ({
      productName: item.product?.name || item.productName,
      quantity: item.quantity,
      unit: item.unit,
      weightGrams: item.weightGrams,
    })));
    const occurredAt = shipment.status === 'received'
      ? shipment.receivedAt ?? shipment.shippedAt ?? shipment.updatedAt
      : shipment.status === 'shipped' || shipment.status === 'delivered'
        ? shipment.shippedAt ?? shipment.updatedAt
        : shipment.updatedAt ?? shipment.createdAt;
    const at = occurredAt.toISOString();
    const stage = restockProgressStage('converted_to_shipment', shipment.status);
    const reminderDate = stage === 'in_transit' ? nextReceiptReminderDate(shipment.shippedAt, now) : null;
    const status = restockFeedStatus('converted_to_shipment', shipment.status);
    return {
      id: `shipment-${shipment.id}`,
      kind: 'restock',
      at,
      whenLabel: formatQueryWhen(at, now),
      dateLabel: formatQueryDateHeading(at),
      timeLabel: formatQueryTime(at),
      title: '匠寵補貨',
      subtitle: summary.summaryLabel,
      status,
      quantityLabel: status,
      restockProgress: {
        stage,
        statusLabel: status,
        summaryLabel: summary.summaryLabel,
        items: summary.items,
        shippedDateLabel: shipment.shippedAt ? formatQueryMonthDay(shipment.shippedAt) : undefined,
        receivedDateLabel: shipment.receivedAt ? formatQueryMonthDay(shipment.receivedAt) : undefined,
        reminderDateLabel: reminderDate ? formatQueryMonthDay(reminderDate) : undefined,
      },
      href: `/pos/shipments/${shipment.id}`,
      searchText: `補貨 ${summary.items.map((item) => item.label).join(' ')} ${status} ${shipment.id}`.toLowerCase(),
    };
  });

  const stockItems: QueryFeedItem[] = stockTxns.map((t) => {
    const sign = t.quantity > 0 ? `＋${t.quantity}` : String(t.quantity);
    const at = t.createdAt.toISOString();
    return {
      id: `stock-${t.id}`,
      kind: 'stock',
      at,
      whenLabel: formatQueryWhen(at, now),
      dateLabel: formatQueryDateHeading(at),
      timeLabel: formatQueryTime(at),
      title: t.product?.name ?? '商品',
      subtitle: stockTypeLabel(t.type),
      status: `現在 ${t.balanceAfter}`,
      eventLabel: stockTypeLabel(t.type),
      quantityLabel: `${sign} ${t.product?.unit ?? ''}`.trim(),
      href: '/pos/stock',
      searchText: `${t.product?.name ?? ''} ${t.type} ${t.id}`.toLowerCase(),
    };
  });

  return [...saleItems, ...refillItems, ...restockItems, ...directRestockItems, ...stockItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
