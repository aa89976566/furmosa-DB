import { prisma } from '@/lib/prisma';
import { resolveCustomerJarMerchantId } from '@/lib/jar-exchange/customer-store-attribution';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';
import { RefillError } from '@/lib/refill/errors';

export async function getRefillPreorderCatalog(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { storeId: true, signupStore: true },
  });
  if (!customer?.storeId && !customer?.signupStore) {
    throw new RefillError('請先確認會員綁定的合作店。', 'STORE_NOT_BOUND', 409);
  }

  const merchantId = await resolveCustomerJarMerchantId(customer);
  const access = merchantId ? await resolveCouponStoreForMerchant(merchantId) : null;
  if (!merchantId || !access) {
    throw new RefillError('目前無法確認取罐店，請聯絡匠寵協助。', 'STORE_NOT_READY', 409);
  }

  const [merchant, store] = await Promise.all([
    prisma.merchant.findFirst({
      where: { id: merchantId, status: 'active' },
      select: { id: true, name: true },
    }),
    prisma.store.findUnique({
      where: { slug: access.storeSlug },
      select: { id: true },
    }),
  ]);
  if (!merchant || !store) {
    throw new RefillError('取罐店目前未開放預購，請聯絡匠寵。', 'STORE_NOT_READY', 409);
  }

  const stocks = await prisma.merchantRefillStock.findMany({
    where: { storeId: store.id, isAvailable: true, quantity: { gt: 0 }, flavour: { isActive: true } },
    select: { flavour: { select: { id: true, name: true, weightGrams: true } } },
    orderBy: { flavourId: 'asc' },
  });

  return { merchant, flavours: stocks.map(({ flavour }) => flavour) };
}
