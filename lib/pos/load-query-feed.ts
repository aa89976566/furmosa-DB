import { prisma } from '@/lib/prisma';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';
import { formatQueryDate, formatQueryDateHeading, formatQueryMonthDay, formatQueryTime, formatQueryWhen, groupSaleLines, type QueryFeedItem, type RestockProgressStage } from '@/lib/pos/query-feed';

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

  const [sales, refills, restocks, stockTxns] = await Promise.all([
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
        shipment: { select: { status: true, shippedAt: true, receivedAt: true, updatedAt: true, items: { select: { productName: true, quantity: true, unit: true } } } },
        items: {
          take: 3,
          select: {
            requestedQuantity: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.merchantStockTxn.findMany({
      where: { merchantId, type: { not: 'sale' }, createdAt: { gte: since } },
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
    const requestedNames = r.items
      .map((it) => `${it.product.name} × ${it.requestedQuantity ?? 0}`)
      .join('、');
    const shipmentNames = r.shipment?.items.map((item) => `${item.productName} × ${item.quantity} ${item.unit ?? '件'}`).join('、');
    const names = shipmentNames || requestedNames;
    const occurredAt = r.shipment?.status === 'received'
      ? r.shipment.receivedAt ?? r.shipment.shippedAt ?? r.updatedAt
      : r.shipment?.status === 'shipped' || r.shipment?.status === 'delivered'
        ? r.shipment.shippedAt ?? r.shipment.updatedAt
        : r.shipment?.updatedAt ?? r.updatedAt ?? r.createdAt;
    const etaLabel = r.expectedArrivalDate
      ? `預計到貨 ${formatQueryDate(r.expectedArrivalDate.toISOString()).replace(/（.*）$/, '')}`
      : null;
    const subtitle = [etaLabel, names || '補貨單'].filter(Boolean).join(' · ');
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
      title: names || '補貨單',
      subtitle,
      status: restockFeedStatus(r.status, r.shipment?.status),
      quantityLabel: restockFeedStatus(r.status, r.shipment?.status),
      restockProgress: {
        stage,
        statusLabel: restockFeedStatus(r.status, r.shipment?.status),
        itemsLabel: names || '補貨單',
        shippedDateLabel: r.shipment?.shippedAt ? formatQueryMonthDay(r.shipment.shippedAt) : undefined,
        receivedDateLabel: r.shipment?.receivedAt ? formatQueryMonthDay(r.shipment.receivedAt) : undefined,
        reminderDateLabel: reminderDate ? formatQueryMonthDay(reminderDate) : undefined,
      },
      href: `/pos/restock/${r.id}`,
      searchText: `補貨 ${names} ${etaLabel ?? ''} ${restockFeedStatus(r.status, r.shipment?.status)} ${r.id}`.toLowerCase(),
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

  return [...saleItems, ...refillItems, ...restockItems, ...stockItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
