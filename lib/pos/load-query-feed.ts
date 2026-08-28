import { prisma } from '@/lib/prisma';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';
import { groupSaleLines, type QueryFeedItem } from '@/lib/pos/query-feed';

function stockTypeLabel(type: string): string {
  switch (type) {
    case 'sale':
      return '銷售';
    case 'restock':
      return '進貨';
    case 'return':
      return '退回';
    case 'adjust':
      return '盤點調整';
    default:
      return '庫存異動';
  }
}

export async function loadQueryFeed(merchantId: string): Promise<QueryFeedItem[]> {
  const since = new Date();
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
    return {
      id: `refill-${o.id}`,
      kind: 'refill',
      at: o.createdAt.toISOString(),
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
    const submitted = ['submitted', 'under_review', 'approved', 'converted_to_shipment'].includes(
      r.status,
    );
    return {
      id: `restock-${r.id}`,
      kind: 'restock',
      at: r.createdAt.toISOString(),
      title: '補貨',
      subtitle: names || '補貨單',
      status: submitted && r.status !== 'converted_to_shipment' ? '已送出' : restockStatusLabelForMerchant(r.status),
      href: `/pos/restock/${r.id}`,
      searchText: `補貨 ${names} ${r.id}`.toLowerCase(),
    };
  });

  const stockItems: QueryFeedItem[] = stockTxns.map((t) => {
    const sign = t.quantity > 0 ? `＋${t.quantity}` : String(t.quantity);
    return {
      id: `stock-${t.id}`,
      kind: 'stock',
      at: t.createdAt.toISOString(),
      title: '庫存',
      subtitle: `${stockTypeLabel(t.type)}${t.product?.name ?? ''} ${sign}`,
      status: `現在 ${t.balanceAfter}`,
      href: '/pos/stock',
      searchText: `${t.product?.name ?? ''} ${t.type} ${t.id}`.toLowerCase(),
    };
  });

  return [...saleItems, ...refillItems, ...restockItems, ...stockItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
