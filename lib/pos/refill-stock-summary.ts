import { prisma } from '@/lib/prisma';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

export type PosRefillStockSummary = {
  total: number;
  flavours: Array<{ id: string; name: string; quantity: number }>;
};

/**
 * 換罐庫存使用換罐計畫自己的 stores / merchant_refill_stocks 資料，
 * 不與寄賣收銀的 MerchantStock 混用，也不會成為一般結帳品項。
 */
export async function loadPosRefillStockSummary(
  merchantId: string,
): Promise<PosRefillStockSummary> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { merchantId: true, name: true },
  });
  if (!merchant) return { total: 0, flavours: [] };

  const store = await prisma.store.findFirst({
    where: {
      OR: [
        { slug: merchantToStoreSlug(merchant.merchantId) },
        { name: { equals: merchant.name, mode: 'insensitive' } },
      ],
    },
    select: {
      refillStocks: {
        where: {
          isAvailable: true,
          quantity: { gt: 0 },
          flavour: {
            isActive: true,
            AND: [
              { OR: [{ availableFrom: null }, { availableFrom: { lte: new Date() } }] },
              { OR: [{ availableUntil: null }, { availableUntil: { gte: new Date() } }] },
            ],
          },
        },
        select: {
          flavourId: true,
          quantity: true,
          flavour: { select: { name: true, sortOrder: true } },
        },
        orderBy: { flavour: { sortOrder: 'asc' } },
      },
    },
  });

  const flavours = (store?.refillStocks ?? []).map((stock) => ({
    id: stock.flavourId,
    name: stock.flavour.name,
    quantity: stock.quantity,
  }));

  return {
    total: flavours.reduce((sum, flavour) => sum + flavour.quantity, 0),
    flavours,
  };
}
