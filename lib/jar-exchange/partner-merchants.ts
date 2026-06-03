import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import type { MerchantType } from '@/lib/merchant-types';
import { prisma } from '@/lib/prisma';

export type JarExchangeMerchantRow = {
  id: string;
  merchantId: string;
  name: string;
  city: string | null;
  types: MerchantType[];
};

export async function listJarExchangeMerchants(): Promise<JarExchangeMerchantRow[]> {
  const merchants = await prisma.merchant.findMany({
    where: { status: 'active' },
    select: { id: true, merchantId: true, name: true, city: true, type: true },
    orderBy: { name: 'asc' },
  });
  const typesMap = await getMerchantTypesMap(
    prisma,
    merchants.map((m) => ({ id: m.id, type: m.type })),
  );

  return merchants
    .map((merchant) => ({
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      city: merchant.city,
      types: typesMap.get(merchant.id) ?? ['consignment'],
    }))
    .filter((merchant) => merchant.types.includes('jar_exchange'));
}
