import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

type DbClient = Prisma.TransactionClient | typeof prisma;

export type CustomerStoreIdentity = {
  storeId?: string | null;
  signupStore?: string | null;
  storeName?: string | null;
};

/**
 * LINE 兌碼只能依會員已綁定的合作店歸屬，且無法唯一對應時寧可不猜。
 * 回傳 Merchant.id，供 POS 租戶隔離、庫存與對帳使用。
 */
export async function resolveCustomerJarMerchantId(
  customer: CustomerStoreIdentity,
  db: DbClient = prisma,
): Promise<string | null> {
  const keys = [...new Set([customer.storeId, customer.signupStore].filter(Boolean))] as string[];

  if (keys.length > 0) {
    const direct = await db.merchant.findMany({
      where: {
        status: 'active',
        OR: [{ id: { in: keys } }, { merchantId: { in: keys } }],
      },
      select: { id: true },
      take: 2,
    });
    if (direct.length === 1) return direct[0].id;

    const stores = await db.store.findMany({
      where: { OR: [{ id: { in: keys } }, { slug: { in: keys } }] },
      select: { slug: true, name: true },
      take: 2,
    });
    if (stores.length === 1) {
      const expected = await db.merchant.findMany({
        where: { status: 'active' },
        select: { id: true, merchantId: true, name: true },
      });
      const matches = expected.filter(
        (merchant) =>
          merchantToStoreSlug(merchant.merchantId) === stores[0].slug ||
          merchant.name.trim().toLowerCase() === stores[0].name.trim().toLowerCase(),
      );
      if (matches.length === 1) return matches[0].id;
    }
  }

  const name = customer.storeName?.trim();
  if (!name) return null;
  const byName = await db.merchant.findMany({
    where: { status: 'active', name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
    take: 2,
  });
  return byName.length === 1 ? byName[0].id : null;
}
