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
    id: string;
    productId: string;
    quantity: number;
    weightGrams: number | null;
  }>;
};

export function validateRestockReceiptShipment(
  shipment: { merchantId: string | null; type: string; status: string },
  sessionMerchantId: string,
): 'ready' | 'already_received' {
  if (!shipment.merchantId || shipment.merchantId !== sessionMerchantId) {
    throw new Error('找不到這張補貨出貨單');
  }
  if (shipment.type !== 'merchant_restock') {
    throw new Error('這不是店家補貨出貨單');
  }
  if (shipment.status === 'received') return 'already_received';
  if (shipment.status !== 'delivered') {
    throw new Error('商品尚未送達，現在不能確認收貨');
  }
  return 'ready';
}

const LEGACY_RESTOCK_NOTE_PREFIX = '來自出貨單 ';
const SHIPMENT_NOTE_SEMANTICS = /出貨單|出貨紀錄/;
const TOKEN_NEIGHBOR = /[A-Za-z0-9-]/;

function legacyRestockNote(shipmentNumber: string) {
  return `${LEGACY_RESTOCK_NOTE_PREFIX}${shipmentNumber}`;
}

function shipmentNumberHasClearBoundaries(
  haystack: string,
  shipmentNumber: string,
  index: number,
) {
  const before = index === 0 ? '' : haystack[index - 1];
  const after = haystack[index + shipmentNumber.length] ?? '';
  return !TOKEN_NEIGHBOR.test(before) && !TOKEN_NEIGHBOR.test(after);
}

function hasBoundedShipmentNumber(note: string, shipmentNumber: string) {
  let from = 0;
  while (from <= note.length) {
    const index = note.indexOf(shipmentNumber, from);
    if (index === -1) return false;
    if (shipmentNumberHasClearBoundaries(note, shipmentNumber, index)) return true;
    from = index + 1;
  }
  return false;
}

type LegacyRestockNoteClass = 'posted' | 'unrelated' | 'ambiguous';

function classifyLegacyRestockNote(
  note: string | null | undefined,
  shipmentNumber: string,
): LegacyRestockNoteClass {
  const trimmed = (note ?? '').trim();
  if (!trimmed) return 'unrelated';
  if (trimmed === legacyRestockNote(shipmentNumber)) return 'posted';

  const exactOther = trimmed.startsWith(LEGACY_RESTOCK_NOTE_PREFIX)
    ? trimmed.slice(LEGACY_RESTOCK_NOTE_PREFIX.length)
    : null;
  if (exactOther !== null && exactOther.length > 0 && !/\s/.test(exactOther)) {
    if (exactOther === shipmentNumber) return 'posted';
    if (!hasBoundedShipmentNumber(exactOther, shipmentNumber)) return 'unrelated';
  }

  if (SHIPMENT_NOTE_SEMANTICS.test(trimmed)) return 'ambiguous';
  return 'unrelated';
}

/** 是否已依出貨單寫入店家進貨庫存。新流程以 shipmentItemId 為準；此函式只相容明確舊備註。 */
export async function merchantRestockAlreadyPosted(
  tx: Prisma.TransactionClient,
  merchantId: string,
  shipmentNumber: string,
) {
  const candidates = await tx.merchantStockTxn.findMany({
    where: {
      merchantId,
      type: 'restock',
      note: { contains: shipmentNumber },
    },
    select: { note: true },
  });

  let foundPosted = false;
  for (const row of candidates) {
    const classified = classifyLegacyRestockNote(row.note, shipmentNumber);
    if (classified === 'posted') {
      foundPosted = true;
      continue;
    }
    if (classified === 'ambiguous') {
      throw new Error('補貨入庫舊資料無法自動判定，請聯絡管理員人工檢查');
    }
  }
  return foundPosted;
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
  if (!shipment.merchantId) throw new Error('補貨出貨單缺少店家');
  if (shipment.items.length === 0) throw new Error('補貨出貨單沒有品項');

  const shipmentItemIds = shipment.items.map((item) => item.id);
  if (
    shipmentItemIds.some((id) => !id) ||
    new Set(shipmentItemIds).size !== shipmentItemIds.length ||
    shipment.items.some((item) => !item.productId || item.quantity <= 0)
  ) {
    throw new Error('補貨出貨單品項資料不完整');
  }

  const postedItems = await tx.merchantStockTxn.findMany({
    where: { shipmentItemId: { in: shipmentItemIds } },
    select: { shipmentItemId: true },
  });
  if (postedItems.length > 0) {
    if (postedItems.length === shipment.items.length) return false;
    throw new Error('補貨入庫紀錄不完整，請聯絡管理員');
  }

  if (await merchantRestockAlreadyPosted(tx, shipment.merchantId, shipment.shipmentNumber)) {
    return false;
  }

  const productIds = [...new Set(shipment.items.map((item) => item.productId))];

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { priceTiers: true },
  });
  const tiersByProduct = new Map(products.map((product) => [product.id, product.priceTiers]));
  const existingProductIds = new Set(products.map((product) => product.id));
  if (productIds.some((productId) => !existingProductIds.has(productId))) {
    throw new Error('補貨出貨單包含不存在的商品');
  }
  const items = shipment.items;

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
        shipmentItemId: item.id,
        note: legacyRestockNote(shipment.shipmentNumber),
      },
    });
  }

  return true;
}
