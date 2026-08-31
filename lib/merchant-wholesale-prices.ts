import { prisma } from '@/lib/prisma';
import type { MerchantWholesalePriceRow } from '@/lib/orders/merchant-wholesale-price';

export async function loadMerchantWholesalePrices(
  merchantId: string,
): Promise<MerchantWholesalePriceRow[]> {
  return prisma.$queryRaw<MerchantWholesalePriceRow[]>`
    SELECT
      "merchantId",
      "productId",
      "variantKey",
      "unitPrice"
    FROM "MerchantWholesalePrice"
    WHERE "merchantId" = ${merchantId}
  `;
}
