import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findRestockShipmentsAlreadyPosted } from '@/lib/merchant-restock-inventory';

export const RECEIPT_REVIEW_MESSAGE = '這張舊單已有入庫或後續盤點紀錄，請由 HQ 核對；目前不會再次加入庫存。';

export function receiptOverlapsStockCount(
  shipment: { shippedAt?: Date | null; createdAt: Date; items: { productId: string }[] },
  stocks: { productId: string; lastCountAt: Date | null }[],
) {
  const departure = shipment.shippedAt ?? shipment.createdAt;
  const ids = new Set(shipment.items.map(item => item.productId));
  return stocks.some(stock => ids.has(stock.productId) && stock.lastCountAt && stock.lastCountAt > departure);
}

/** Read only. A newer physical count makes a historical receipt ambiguous, not a new delivery. */
export async function loadReceiptReviewIds(merchantId: string, shipmentIds: string[], db: Prisma.TransactionClient = prisma, strict = false) {
  if (!shipmentIds.length) return new Set<string>();
  try {
  const shipments = await db.shipment.findMany({
    where: { id: { in: shipmentIds }, merchantId, type: 'merchant_restock', status: { in: ['shipped', 'delivered'] } },
    select: { id: true, shipmentNumber: true, shippedAt: true, createdAt: true, items: { select: { id: true, productId: true, quantity: true } } },
  });
  if (!shipments.length) return new Set<string>();
  const [evidence, stocks] = await Promise.all([
    findRestockShipmentsAlreadyPosted(db, merchantId, shipments),
    db.merchantStock.findMany({ where: { merchantId, productId: { in: shipments.flatMap(s => s.items.map(i => i.productId)) } }, select: { productId: true, lastCountAt: true } }),
  ]);
  return new Set(shipments.filter(s => evidence.posted.has(s.id) || receiptOverlapsStockCount(s, stocks)).map(s => s.id));
  } catch {
    if (strict) throw new Error('舊單入庫證據暫時無法讀取，請稍後重新核對');
    // Evidence unavailable: stop asking the merchant to post ambiguous stock.
    return new Set(shipmentIds);
  }
}
