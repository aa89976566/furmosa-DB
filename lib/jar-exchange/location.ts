import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ZHUWO_CONSIGNMENT_BRANCHES } from '@/lib/stores/zhuwo-branches';

type Db = Prisma.TransactionClient | typeof prisma;

/** 開戶／核銷 slug → Merchant Location */
export async function resolveMerchantIdByRedeemSlug(
  slug: string | null | undefined,
  db: Db = prisma,
): Promise<string | null> {
  const s = (slug ?? '').trim();
  if (!s) return null;

  const byProfile = await db.merchantRedeemProfile.findFirst({
    where: { slug: s, active: true },
    select: { merchantId: true },
  });
  if (byProfile) return byProfile.merchantId;

  const zhuwo = ZHUWO_CONSIGNMENT_BRANCHES.find((b) => b.storeSlug === s);
  if (zhuwo) {
    const m = await db.merchant.findFirst({
      where: {
        OR: [{ merchantId: zhuwo.merchantId }, { name: zhuwo.name }],
        status: 'active',
      },
      select: { id: true },
    });
    if (m) return m.id;
  }

  // mer_0001 → MER-0001
  if (/^mer_\d+$/i.test(s)) {
    const merchantId = s.toUpperCase().replace('_', '-');
    const m = await db.merchant.findUnique({
      where: { merchantId },
      select: { id: true },
    });
    if (m) return m.id;
  }

  return null;
}

export async function resolveSignupLocationIdForCustomer(
  input: {
    signupLocationId?: string | null;
    storeId?: string | null;
    signupStore?: string | null;
  },
  db: Db = prisma,
): Promise<string | null> {
  if (input.signupLocationId) {
    const ok = await db.merchant.findFirst({
      where: { id: input.signupLocationId, status: 'active' },
      select: { id: true },
    });
    if (ok) return ok.id;
  }
  return (
    (await resolveMerchantIdByRedeemSlug(input.storeId, db)) ??
    (await resolveMerchantIdByRedeemSlug(input.signupStore, db))
  );
}

export const SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE =
  '請先完成「幫毛孩開戶」並選擇合作店家，才能存罐累點。點下方按鈕開始開戶。';
