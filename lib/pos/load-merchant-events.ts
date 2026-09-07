import { prisma } from '@/lib/prisma';

export type MerchantEvent = {
  id: string;
  title: string;
  detail: string;
  statusLabel: string;
  occurredAt: Date;
  actionRequired: boolean;
  href: string | null;
  hqNote: string | null;
};

type ShipmentSummary = {
  id: string;
  shipmentNumber: string;
  status: string;
  updatedAt: Date;
  items: Array<{ productName: string; quantity: number }>;
};

function itemSummary(items: Array<{ productName: string; quantity: number }>) {
  if (items.length === 0) return '尚未加入出貨品項';
  const visible = items.slice(0, 2).map((item) => `${item.productName} × ${item.quantity}`);
  return items.length > 2 ? `${visible.join('、')}，另 ${items.length - 2} 項` : visible.join('、');
}

export function shipmentEvent(
  shipment: ShipmentSummary,
  href: string | null,
): MerchantEvent {
  const presentation: Record<string, { title: string; status: string; action: boolean }> = {
    pending: { title: 'HQ 已建立出貨單', status: '等待備貨', action: false },
    packed: { title: '商品已完成備貨', status: '已備妥', action: false },
    shipped: { title: '商品已出貨', status: '運送中', action: false },
    delivered: { title: '商品已送達，請確認收貨', status: '待驗收', action: Boolean(href) },
    received: { title: '店家已完成收貨', status: '已收貨', action: false },
    cancelled: { title: '出貨單已取消', status: '已取消', action: false },
  };
  const state = presentation[shipment.status] ?? {
    title: '出貨狀態已更新',
    status: shipment.status,
    action: false,
  };
  return {
    id: `shipment-${shipment.id}`,
    title: state.title,
    detail: `${shipment.shipmentNumber} · ${itemSummary(shipment.items)}`,
    statusLabel: state.status,
    occurredAt: shipment.updatedAt,
    actionRequired: state.action,
    href,
    hqNote: null,
  };
}

export async function loadMerchantEvents(merchantId: string): Promise<MerchantEvent[]> {
  const [requests, directShipments] = await Promise.all([
    prisma.restockRequest.findMany({
      where: { merchantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        hqNote: true,
        items: {
          select: { requestedQuantity: true, product: { select: { name: true } } },
        },
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            updatedAt: true,
            items: { select: { productName: true, quantity: true } },
          },
        },
      },
    }),
    prisma.shipment.findMany({
      where: { merchantId, type: 'merchant_restock', restockRequest: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        updatedAt: true,
        items: { select: { productName: true, quantity: true } },
      },
    }),
  ]);

  const requestEvents = requests.map<MerchantEvent>((request) => {
    if (request.shipment) {
      return {
        ...shipmentEvent(request.shipment, `/pos/restock/${request.id}`),
        hqNote: request.hqNote,
      };
    }
    const presentation: Record<string, { title: string; status: string; action: boolean }> = {
      submitted: { title: '補貨申請已送出', status: '等待 HQ 審核', action: false },
      under_review: { title: 'HQ 正在審核補貨申請', status: '審核中', action: false },
      approved: { title: '補貨申請已核准', status: '已核准', action: false },
      rejected: { title: '補貨申請未核准', status: '請查看回覆', action: true },
      cancelled: { title: '補貨申請已取消', status: '已取消', action: false },
    };
    const state = presentation[request.status] ?? {
      title: '補貨申請狀態已更新',
      status: request.status,
      action: false,
    };
    const items = request.items.map((item) => ({
      productName: item.product.name,
      quantity: item.requestedQuantity ?? 0,
    }));
    return {
      id: `request-${request.id}`,
      title: state.title,
      detail: itemSummary(items),
      statusLabel: state.status,
      occurredAt: request.updatedAt,
      actionRequired: state.action,
      href: `/pos/restock/${request.id}`,
      hqNote: request.hqNote,
    };
  });

  return [...requestEvents, ...directShipments.map((shipment) => shipmentEvent(shipment, null))]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 50);
}
