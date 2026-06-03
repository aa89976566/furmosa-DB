import type { Prisma } from '@prisma/client';
import { ensureOrdersForOrphanRestockShipments, migrateRestockOrdersToConsignment } from '@/lib/merchant-restock-order';
import { prisma } from '@/lib/prisma';

/** 品項指紋（用於判斷是否為同一批進貨） */
export function shipmentItemsFingerprint(
  items: Array<{ productId: string; quantity: number }>,
): string {
  return items
    .slice()
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((i) => `${i.productId}:${i.quantity}`)
    .join('|');
}

/** 出貨隊列預設：不含已送達／已取消，且排除已取消訂單的待出貨單 */
export const activeShipmentQueueWhere: Prisma.ShipmentWhereInput = {
  status: { in: ['pending', 'packed', 'shipped'] },
  OR: [{ orderId: null }, { order: { status: { not: 'cancelled' } } }],
};

/** 取消同一訂單多張待出貨中的重複出貨單（保留最新一張） */
export async function consolidateDuplicateOrderShipments(): Promise<number> {
  const rows = await prisma.shipment.findMany({
    where: {
      type: 'customer_order',
      orderId: { not: null },
      status: { in: ['pending', 'packed'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderId: true },
  });

  const keepByOrder = new Set<string>();
  const toCancel: string[] = [];

  for (const row of rows) {
    if (!row.orderId) continue;
    if (keepByOrder.has(row.orderId)) {
      toCancel.push(row.id);
    } else {
      keepByOrder.add(row.orderId);
    }
  }

  if (toCancel.length === 0) return 0;

  await prisma.shipment.updateMany({
    where: { id: { in: toCancel } },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });

  return toCancel.length;
}

/** 取消同一店家、相同品項的多張待出貨進貨單（保留最新一張） */
export async function consolidateDuplicateMerchantRestockShipments(): Promise<number> {
  const rows = await prisma.shipment.findMany({
    where: {
      type: 'merchant_restock',
      merchantId: { not: null },
      status: { in: ['pending', 'packed'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      merchantId: true,
      items: { select: { productId: true, quantity: true } },
    },
  });

  const keepKeys = new Set<string>();
  const toCancel: string[] = [];

  for (const row of rows) {
    if (!row.merchantId) continue;
    const key = `${row.merchantId}|${shipmentItemsFingerprint(row.items)}`;
    if (keepKeys.has(key)) {
      toCancel.push(row.id);
    } else {
      keepKeys.add(key);
    }
  }

  if (toCancel.length === 0) return 0;

  await prisma.shipment.updateMany({
    where: { id: { in: toCancel } },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });

  return toCancel.length;
}

/** 已取消訂單的待出貨單一併標記取消 */
export async function cancelShipmentsForCancelledOrders(): Promise<number> {
  const result = await prisma.shipment.updateMany({
    where: {
      status: { in: ['pending', 'packed'] },
      order: { status: 'cancelled' },
    },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });
  return result.count;
}

/** 已有待出貨單但訂單仍為草稿 → 改為已確認 */
export async function syncDraftOrdersWithPendingShipments(): Promise<number> {
  const result = await prisma.order.updateMany({
    where: {
      status: 'draft',
      shipments: {
        some: {
          type: 'customer_order',
          status: { in: ['pending', 'packed'] },
        },
      },
    },
    data: { status: 'confirmed' },
  });
  return result.count;
}

/** 佇列載入前整理資料 */
export async function maintainShipmentQueueIntegrity() {
  await ensureOrdersForOrphanRestockShipments();
  await migrateRestockOrdersToConsignment();
  await cancelShipmentsForCancelledOrders();
  await consolidateDuplicateOrderShipments();
  await consolidateDuplicateMerchantRestockShipments();
  await syncDraftOrdersWithPendingShipments();
}

/** 列表去重：訂單出貨依 orderId；店家進貨依 merchantId + 品項指紋 */
export function dedupeShipmentsByOrder<
  T extends {
    id: string;
    orderId: string | null;
    merchantId?: string | null;
    type: string;
    createdAt: Date;
    items?: Array<{ productId: string; quantity: number }>;
  },
>(shipments: T[]): T[] {
  const seenOrders = new Set<string>();
  const seenRestocks = new Set<string>();
  const sorted = [...shipments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const result: T[] = [];

  for (const s of sorted) {
    if (s.type === 'customer_order' && s.orderId) {
      if (seenOrders.has(s.orderId)) continue;
      seenOrders.add(s.orderId);
    }
    if (s.type === 'merchant_restock' && s.merchantId && s.items?.length) {
      const key = `${s.merchantId}|${shipmentItemsFingerprint(s.items)}`;
      if (seenRestocks.has(key)) continue;
      seenRestocks.add(key);
    }
    result.push(s);
  }

  return result;
}
