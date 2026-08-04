import type { Prisma, PrismaClient } from '@prisma/client';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';
import { RefillError } from '@/lib/refill/errors';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';

export {
  assertPaymentDoesNotLockFlavour,
  canEnableFulfilment,
} from '@/lib/refill/fulfilment-rules';

type Db = PrismaClient | Prisma.TransactionClient;

export type MerchantStockFlavourRow = {
  flavourId: string;
  code: string;
  name: string;
  weightGrams: number;
  label: string;
  quantity: number;
  isAvailable: boolean;
};

/** Merchant（POS／預約）→ Store（換罐口味庫存）解析 */
export async function resolveStoreIdForMerchant(
  db: Db,
  merchantId: string,
): Promise<string> {
  const merchant = await db.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, merchantId: true, name: true },
  });
  if (!merchant) {
    throw new RefillError('找不到店家。', 'MERCHANT_NOT_FOUND', 404);
  }

  const slug = merchantToStoreSlug(merchant.merchantId);
  const bySlug = await db.store.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (bySlug) return bySlug.id;

  const byName = await db.store.findFirst({
    where: { name: { equals: merchant.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (byName) return byName.id;

  throw new RefillError(
    '此店家尚未同步換罐庫存主檔，請聯絡總部後再交付。',
    'STORE_NOT_LINKED',
    409,
  );
}

export async function listMerchantFulfilmentStock(
  db: Db,
  merchantId: string,
): Promise<MerchantStockFlavourRow[]> {
  const storeId = await resolveStoreIdForMerchant(db, merchantId);
  const stocks = await db.merchantRefillStock.findMany({
    where: {
      storeId,
      flavour: { isActive: true },
    },
    include: { flavour: true },
    orderBy: { flavour: { sortOrder: 'asc' } },
  });
  return stocks.map((s) => ({
    flavourId: s.flavour.id,
    code: s.flavour.code,
    name: s.flavour.name,
    weightGrams: s.flavour.weightGrams,
    label: formatFlavourLabel(s.flavour.name, s.flavour.weightGrams),
    quantity: s.quantity,
    isAvailable: s.isAvailable && s.quantity > 0,
  }));
}

/**
 * 原子扣減 1：WHERE quantity > 0 防止負庫存競態。
 * 必須在既有 transaction 內呼叫。
 */
export async function decrementFlavourStockInTxn(
  tx: Prisma.TransactionClient,
  input: {
    storeId: string;
    flavourId: string;
    actorUserId?: string | null;
    note?: string | null;
    refillOrderId?: string | null;
  },
): Promise<{ quantityAfter: number }> {
  const claimed = await tx.merchantRefillStock.updateMany({
    where: {
      storeId: input.storeId,
      flavourId: input.flavourId,
      isAvailable: true,
      quantity: { gt: 0 },
    },
    data: { quantity: { decrement: 1 } },
  });
  if (claimed.count === 0) {
    throw new RefillError('此口味目前沒有庫存，請改選其他現貨。', 'OUT_OF_STOCK', 409);
  }

  const row = await tx.merchantRefillStock.findUnique({
    where: {
      storeId_flavourId: {
        storeId: input.storeId,
        flavourId: input.flavourId,
      },
    },
    select: { quantity: true },
  });
  const quantityAfter = row?.quantity ?? 0;

  await tx.refillStockTxn.create({
    data: {
      storeId: input.storeId,
      flavourId: input.flavourId,
      changeQty: -1,
      quantityAfter,
      reason: 'fulfill',
      note:
        input.note ??
        (input.refillOrderId ? `refill_order:${input.refillOrderId}` : null),
      createdByUserId: input.actorUserId ?? null,
    },
  });

  return { quantityAfter };
}
