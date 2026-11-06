import type { Prisma } from '@prisma/client';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';

/** Same physical jars: called only inside the idempotent shipment receipt transaction. */
export async function receiveLinkedRefillStock(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; productId: string; quantity: number; shipmentNumber: string },
) {
  const links = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM refill_flavours WHERE product_id = ${input.productId}
  `;
  // Legacy products without a flavour link retain their existing receipt behavior.
  if (!links.length) return;
  if (links.length !== 1) throw new Error('換罐商品對應多個口味，請聯絡管理員核對');
  const access = await resolveCouponStoreForMerchant(input.merchantId, tx);
  if (!access) throw new Error('店家換罐庫存尚未設定，請聯絡管理員');
  const store = await tx.store.findUnique({ where: { slug: access.storeSlug }, select: { id: true } });
  if (!store) throw new Error('店家換罐庫存尚未設定，請聯絡管理員');
  const flavourId = links[0].id;
  const stock = await tx.merchantRefillStock.upsert({
    where: { storeId_flavourId: { storeId: store.id, flavourId } },
    update: { quantity: { increment: input.quantity } },
    create: { storeId: store.id, flavourId, quantity: input.quantity, isAvailable: true },
  });
  await tx.refillStockTxn.create({ data: {
    storeId: store.id, flavourId, changeQty: input.quantity, quantityAfter: stock.quantity,
    reason: 'restock', note: `確認收貨 ${input.shipmentNumber}；同步同一批罐裝商品，不重複請款。`,
  } });
}
