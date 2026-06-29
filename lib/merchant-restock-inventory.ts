import type { Prisma } from '@prisma/client';
import { reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import {
  merchantStockUniqueWhere,
  resolveTierIdFromWeightGrams,
} from '@/lib/merchant-stock-key';

export type RestockShipmentForInventory = {
  shipmentNumber: string;
  merchantId: string;
  items: Array<{
    productId: string;
    quantity: number;
    weightGrams: number | null;
  }>;
};

/** 是否已依出貨單寫入店家進貨庫存 */
export async function merchantRestockAlreadyPosted(
  tx: Prisma.TransactionClient,
  merchantId: string,
  shipmentNumber: string,
) {
  const count = await tx.merchantStockTxn.count({
    where: {
      merchantId,
      type: 'restock',
      note: { contains: shipmentNumber },
    },
  });
  return count > 0;
}

/**
 * 寄賣店進貨：依出貨單品項增加 MerchantStock（冪等，同一出貨單不重複入庫）。
 * @returns 是否有寫入庫存
 */
export async function applyMerchantRestockFromShipment(
  tx: Prisma.TransactionClient,
  shipment: RestockShipmentForInventory,
  now: Date,
): Promise<boolean> {
  if (!shipment.merchantId || shipment.items.length === 0) return false;

  if (await merchantRestockAlreadyPosted(tx, shipment.merchantId, shipment.shipmentNumber)) {
    return false;
  }

  const productIds = [...new Set(shipment.items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { priceTiers: true },
  });
  const tiersByProduct = new Map(products.map((product) => [product.id, product.priceTiers]));

  const txnNumbers = await reserveStockTxnNumbers(tx, shipment.items.length);
  for (let i = 0; i < shipment.items.length; i++) {
    const item = shipment.items[i];
    const tierId = resolveTierIdFromWeightGrams(
      tiersByProduct.get(item.productId) ?? [],
      item.weightGrams,
    );
    const stockWhere = merchantStockUniqueWhere(
      shipment.merchantId,
      item.productId,
      tierId,
    );
    const stock = await tx.merchantStock.upsert({
      where: stockWhere,
      update: { quantity: { increment: item.quantity }, lastRestockAt: now },
      create: {
        merchantId: shipment.merchantId,
        productId: item.productId,
        tierId,
        quantity: item.quantity,
        lastRestockAt: now,
      },
    });
    await tx.merchantStockTxn.create({
      data: {
        txnNumber: txnNumbers[i],
        merchantId: shipment.merchantId,
        productId: item.productId,
        type: 'restock',
        quantity: item.quantity,
        balanceAfter: stock.quantity,
        note: `來自出貨單 ${shipment.shipmentNumber}`,
      },
    });
  }

  return true;
}
