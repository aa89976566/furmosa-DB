import { prisma } from '@/lib/prisma';

export type PosAccount = {
  merchantId?: string;
  storeName: string;
  storeCity: string | null;
  username: string;
  staffName: string;
  phone: string | null;
  address: string | null;
  contactName: string | null;
};

export type PosMerchantProfile = {
  id: string;
  merchantId: string;
  name: string;
  city: string | null;
  phone: string | null;
  address: string | null;
  contactName: string | null;
};

export function loadPosMerchantProfile(merchantId: string): Promise<PosMerchantProfile | null> {
  return prisma.merchant.findFirst({
    where: { id: merchantId },
    select: {
      id: true,
      merchantId: true,
      name: true,
      city: true,
      phone: true,
      address: true,
      contactName: true,
    },
  });
}

export async function loadPosAccount(
  merchantId: string,
  username: string,
  merchantRequest: Promise<PosMerchantProfile | null> = loadPosMerchantProfile(merchantId),
): Promise<PosAccount> {
  const [merchant, staff] = await Promise.all([
    merchantRequest,
    prisma.merchantUser.findFirst({
      where: { merchantId, username },
      select: { displayName: true, username: true },
    }),
  ]);
  const staffName = staff?.displayName?.trim() || staff?.username || username;
  return {
    merchantId,
    storeName: merchant?.name ?? '店家',
    storeCity: merchant?.city ?? null,
    username,
    staffName,
    phone: merchant?.phone ?? null,
    address: merchant?.address ?? null,
    contactName: merchant?.contactName ?? null,
  };
}
