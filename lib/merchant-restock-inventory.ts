import type { Prisma } from '@prisma/client';
import { reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import {
  merchantStockUniqueWhere,
  resolveTierIdFromWeightGrams,
} from '@/lib/merchant-stock-key';
import { restockIncreasesStoreOnHand } from '@/lib/pos/domain-contract';

export const MERCHANT_RESTOCK_SHIPMENT_TYPE = 'merchant_restock';

export type RestockShipmentForInventory = {
  shipmentNumber: string;
  merchantId: string;
  items: Array<{
    productId: string;
    quantity: number;
    weightGrams: number | null;
  }>;
};

export type MerchantRestockStatusChange = {
  nextStatus: string;
  shipmentType: string;
  shipmentNumber: string;
  merchantId: string | null | undefined;
  items: RestockShipmentForInventory['items'];
};

/**
 * 寄賣補貨只在 delivered 入店家庫存。
 * MerchantStock.quantity 是店內可賣實體量，不是在途。
 * 非寄賣出貨（客戶單、訂閱）不走這條入庫。
 */
export function shouldApplyMerchantRestockInventory(
  nextStatus: string,
  shipmentType: string,
): boolean {
  if (shipmentType !== MERCHANT_RESTOCK_SHIPMENT_TYPE) return false;
  return restockIncreasesStoreOnHand(nextStatus);
}

/**
 * 依出貨狀態決定是否入庫。shipped 不寫庫存；delivered 才呼叫既有入庫函式。
 * 必須與出貨狀態更新放在同一個 DB transaction，失敗才不會留下半套。
 */
export async function applyMerchantRestockInventoryForStatusChange(
  tx: Prisma.TransactionClient,
  input: MerchantRestockStatusChange,
  now: Date,
): Promise<boolean> {
  if (!shouldApplyMerchantRestockInventory(input.nextStatus, input.shipmentType)) {
    return false;
  }
  if (!input.merchantId) return false;
  return applyMerchantRestockFromShipment(
    tx,
    {
      shipmentNumber: input.shipmentNumber,
      merchantId: input.merchantId,
      items: input.items,
    },
    now,
  );
}

/** 是否已依出貨單寫入店家進貨庫存（note 含出貨單號；含舊程式在 shipped 時寫入的流水） */
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

  const productIds = [...new Set(shipment.items.map((item) => item.productId).filter(Boolean))];
  if (productIds.length === 0) return false;

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { priceTiers: true },
  });
  const tiersByProduct = new Map(products.map((product) => [product.id, product.priceTiers]));
  const existingProductIds = new Set(products.map((product) => product.id));
  const items = shipment.items.filter(
    (item) => item.productId && item.quantity > 0 && existingProductIds.has(item.productId),
  );
  if (items.length === 0) return false;

  const txnNumbers = await reserveStockTxnNumbers(tx, items.length);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
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
