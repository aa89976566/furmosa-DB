import { prisma } from '@/lib/prisma';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';
import { formatQueryDate, formatQueryTime, formatQueryWhen, groupSaleLines, type QueryFeedItem } from '@/lib/pos/query-feed';

function stockTypeLabel(type: string, quantity: number): string {
  switch (type) {
    case 'restock':
      return '補登到貨';
    case 'return':
      return '退回匠寵／調撥';
    case 'adjust':
      return quantity < 0 ? '盤損／盤點更正' : '盤盈／盤點更正';
    default:
      return '庫存異動';
  }
}

export function shouldShowStandaloneStockEvent(input: {
  type: string;
  shipmentItemId?: string | null;
}): boolean {
  // 銷售扣庫存已有「銷售」事件；出貨明細入庫已有「收貨」事件。
  // 兩者仍保留在資料庫稽核流水，但不在店員的事件首頁重複顯示。
  if (input.type === 'sale') return false;
  if (input.type === 'restock' && input.shipmentItemId) return false;
  return true;
}

export function restockFeedStatus(requestStatus: string, shipmentStatus?: string | null): string {
  if (requestStatus !== 'converted_to_shipment') {
    return ['submitted', 'under_review', 'approved'].includes(requestStatus)
      ? '已送出'
      : restockStatusLabelForMerchant(requestStatus);
  }
  switch (shipmentStatus) {
    case 'shipped':
    case 'delivered':
      return '是否已收到？';
    case 'received':
      return '已收貨入庫';
    case 'cancelled':
      return '出貨已取消';
    default:
      return '備貨中';
  }
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
        status: true,
        shipment: { select: { status: true, shippedAt: true, receivedAt: true } },
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
      where: { merchantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        createdAt: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        shipmentItemId: true,
        note: true,
        product: { select: { name: true } },
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
      dateLabel: formatQueryDate(at),
      timeLabel: formatQueryTime(at),
      title: '換罐',
      subtitle,
      status,
      href: `/pos/refill/${o.id}`,
      searchText: `${o.customer.name} ${oldCode} ${newCode} ${o.oldContainerSerial ?? ''} ${o.newContainerSerial ?? ''}`.toLowerCase(),
    };
  });

  const restockItems: QueryFeedItem[] = restocks.map((r) => {
    const names = r.items
      .map((it) => `${it.product.name} × ${it.requestedQuantity ?? 0}`)
      .join('、');
    const occurredAt = r.shipment?.status === 'received'
      ? r.shipment.receivedAt ?? r.shipment.shippedAt ?? r.createdAt
      : r.shipment?.status === 'shipped' || r.shipment?.status === 'delivered'
        ? r.shipment.shippedAt ?? r.createdAt
        : r.createdAt;
    const at = occurredAt.toISOString();
    const received = r.shipment?.status === 'received';
    return {
      id: `restock-${r.id}`,
      kind: received ? 'receipt' : 'restock',
      at,
      whenLabel: formatQueryWhen(at, now),
      dateLabel: formatQueryDate(at),
      timeLabel: formatQueryTime(at),
      title: received ? '收到匠寵補貨' : '補貨',
      subtitle: names || '補貨單',
      status: restockFeedStatus(r.status, r.shipment?.status),
      href: `/pos/restock/${r.id}`,
      searchText: `補貨 ${names} ${r.id}`.toLowerCase(),
    };
  });

  const stockItems: QueryFeedItem[] = stockTxns
    .filter(shouldShowStandaloneStockEvent)
    .map((t) => {
      const sign = t.quantity > 0 ? `＋${t.quantity}` : String(t.quantity);
      const at = t.createdAt.toISOString();
      return {
        id: `stock-${t.id}`,
        kind: 'stock',
        at,
        whenLabel: formatQueryWhen(at, now),
        dateLabel: formatQueryDate(at),
        timeLabel: formatQueryTime(at),
        title: stockTypeLabel(t.type, t.quantity),
        subtitle: `${t.product?.name ?? '商品'} ${sign}`,
        status: `調整後 ${t.balanceAfter}`,
        href: '/pos/stock',
        searchText: `${stockTypeLabel(t.type, t.quantity)} ${t.product?.name ?? ''} ${t.note ?? ''} ${t.type} ${t.id}`.toLowerCase(),
      };
    });

  return [...saleItems, ...refillItems, ...restockItems, ...stockItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
