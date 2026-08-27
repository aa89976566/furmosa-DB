import { prisma } from '@/lib/prisma';

export type PosAccount = {
  storeName: string;
  storeCity: string | null;
  username: string;
  phone: string | null;
  address: string | null;
  contactName: string | null;
};

export async function loadPosAccount(
  merchantId: string,
  username: string,
): Promise<PosAccount> {
  const merchant = await prisma.merchant.findFirst({
    where: { id: merchantId },
    select: {
      name: true,
      city: true,
      phone: true,
      address: true,
      contactName: true,
    },
  });
  return {
    storeName: merchant?.name ?? '店家',
    storeCity: merchant?.city ?? null,
    username,
    phone: merchant?.phone ?? null,
    address: merchant?.address ?? null,
    contactName: merchant?.contactName ?? null,
  };
}
