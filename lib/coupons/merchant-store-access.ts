import { prisma } from '@/lib/prisma';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

export type MerchantCouponStore = {
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  storeSlug: string;
  storeName: string;
};

/**
 * POS 核銷店家只能由登入 session 的 Merchant.id 解析，不能接受瀏覽器傳入店家。
 */
export async function resolveCouponStoreForMerchant(
  merchantId: string,
): Promise<MerchantCouponStore | null> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, merchantId: true, name: true, status: true },
  });
  if (!merchant || merchant.status !== 'active') return null;

  const expectedSlug = merchantToStoreSlug(merchant.merchantId);
  const exactStore = await prisma.store.findUnique({
    where: { slug: expectedSlug },
    select: { slug: true, name: true },
  });
  const sameNameStores = exactStore
    ? []
    : await prisma.store.findMany({
        where: { name: { equals: merchant.name, mode: 'insensitive' } },
        orderBy: { slug: 'asc' },
        take: 2,
        select: { slug: true, name: true },
      });
  // 同名店超過一間時拒絕猜測，避免跨店核銷。
  const store = exactStore ?? (sameNameStores.length === 1 ? sameNameStores[0] : null);
  if (!store) return null;

  return {
    merchantId: merchant.id,
    merchantCode: merchant.merchantId,
    merchantName: merchant.name,
    storeSlug: store.slug,
    storeName: store.name,
  };
}
