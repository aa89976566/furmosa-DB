import { prisma } from '@/lib/prisma';

export type PosAccount = {
  storeName: string;
  storeCity: string | null;
  username: string;
  staffName: string;
  phone: string | null;
  address: string | null;
  contactName: string | null;
};

export async function loadPosAccount(
  merchantId: string,
  username: string,
): Promise<PosAccount> {
  const [merchant, staff] = await Promise.all([
    prisma.merchant.findFirst({
      where: { id: merchantId },
      select: {
        name: true,
        city: true,
        phone: true,
        address: true,
        contactName: true,
      },
    }),
    prisma.merchantUser.findFirst({
      where: { merchantId, username },
      select: { displayName: true, username: true },
    }),
  ]);
  const staffName = staff?.displayName?.trim() || staff?.username || username;
  return {
    storeName: merchant?.name ?? '店家',
    storeCity: merchant?.city ?? null,
    username,
    staffName,
    phone: merchant?.phone ?? null,
    address: merchant?.address ?? null,
    contactName: merchant?.contactName ?? null,
  };
}
