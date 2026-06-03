import { addDays } from 'date-fns';
import type { GroomingCoupon, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateUniqueFurmosaCouponCode, normalizeCouponCode } from '@/lib/coupons/codes';
import {
  GROOMING_COUPON_DISCOUNT,
  GROOMING_COUPON_POINTS,
  GROOMING_COUPON_TYPE,
  GROOMING_COUPON_VALIDITY_DAYS,
  type CouponStatus,
} from '@/lib/coupons/constants';
import { appendPointsLedger, getPointsBalance } from '@/lib/jar-exchange/points';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { resolvePartnerStoreBySlug, resolvePartnerStoreLabel } from '@/lib/stores/partner-stores';

export type CouponView = {
  id: string;
  couponCode: string;
  storeId: string;
  storeName: string;
  type: string;
  discountAmount: number;
  pointsUsed: number;
  status: CouponStatus;
  createdAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedStore: string | null;
  redeemedBy: string | null;
  customerName?: string;
};

export type CouponVerifyResult =
  | { ok: true; coupon: CouponView; customerName: string }
  | { ok: false; error: string; coupon?: CouponView };

export type CouponRedeemStoreResult =
  | { ok: true; coupon: CouponView }
  | { ok: false; error: string; coupon?: CouponView };

function toCouponView(
  row: GroomingCoupon & { customer?: { name: string } | null },
): CouponView {
  return {
    id: row.id,
    couponCode: row.couponCode,
    storeId: row.storeId,
    storeName: row.storeName,
    type: row.type,
    discountAmount: row.discountAmount,
    pointsUsed: row.pointsUsed,
    status: row.status as CouponStatus,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    redeemedAt: row.redeemedAt,
    redeemedStore: row.redeemedStore,
    redeemedBy: row.redeemedBy,
    customerName: row.customer?.name,
  };
}

export function isCouponExpired(coupon: Pick<GroomingCoupon, 'expiresAt' | 'status'>, now = new Date()) {
  return coupon.status === 'available' && coupon.expiresAt < now;
}

/** 將已過期但仍為 available 的券標記 expired */
export async function expireCoupons(now = new Date()) {
  const result = await prisma.groomingCoupon.updateMany({
    where: {
      status: 'available',
      expiresAt: { lt: now },
    },
    data: { status: 'expired' },
  });
  return result.count;
}

export async function expireCouponsForCustomer(customerId: string, now = new Date()) {
  await prisma.groomingCoupon.updateMany({
    where: {
      customerId,
      status: 'available',
      expiresAt: { lt: now },
    },
    data: { status: 'expired' },
  });
}

export async function listCouponsForCustomer(customerId: string): Promise<{
  available: CouponView[];
  redeemed: CouponView[];
  expired: CouponView[];
}> {
  await expireCouponsForCustomer(customerId);
  const rows = await prisma.groomingCoupon.findMany({
    where: { customerId },
    orderBy: [{ status: 'asc' }, { expiresAt: 'desc' }],
  });
  const views = rows.map((r) => toCouponView(r));
  return {
    available: views.filter((c) => c.status === 'available'),
    redeemed: views.filter((c) => c.status === 'redeemed'),
    expired: views.filter((c) => c.status === 'expired'),
  };
}

export type RedeemGroomingCouponResult =
  | {
      ok: true;
      coupon: CouponView;
      pointsSpent: number;
      balanceAfter: number;
    }
  | { ok: false; error: string };

export async function redeemGroomingCouponForCustomer(
  customerId: string,
): Promise<RedeemGroomingCouponResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, storeId: true, storeName: true, signupStore: true },
  });
  if (!customer) return { ok: false, error: '找不到會員' };

  const storeId = customer.storeId ?? customer.signupStore;
  const storeName =
    customer.storeName ?? (storeId ? await resolvePartnerStoreLabel(storeId) : null);

  if (!storeId || !storeName) {
    return { ok: false, error: '尚未綁定合作美容院，請聯絡客服' };
  }

  const balance = await getPointsBalance(prisma, customerId);
  if (balance < GROOMING_COUPON_POINTS) {
    return { ok: false, error: `點數不足，需 ${GROOMING_COUPON_POINTS} 點（目前 ${balance} 點）` };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bal = await getPointsBalance(tx, customerId);
      if (bal < GROOMING_COUPON_POINTS) {
        throw new CouponServiceError('點數不足', 409);
      }

      await ensureJarExchangeService(tx, customerId);

      const couponCode = await generateUniqueFurmosaCouponCode();
      const expiresAt = addDays(new Date(), GROOMING_COUPON_VALIDITY_DAYS);

      const coupon = await tx.groomingCoupon.create({
        data: {
          customerId,
          couponCode,
          storeId,
          storeName,
          type: GROOMING_COUPON_TYPE,
          discountAmount: GROOMING_COUPON_DISCOUNT,
          pointsUsed: GROOMING_COUPON_POINTS,
          status: 'available',
          expiresAt,
        },
      });

      const ledger = await appendPointsLedger(tx, {
        customerId,
        sourceType: 'grooming_coupon_redemption',
        sourceRefId: coupon.id,
        pointsChange: -GROOMING_COUPON_POINTS,
        note: `兌換美容折價券 ${couponCode}`,
      });

      return {
        coupon: toCouponView(coupon),
        pointsSpent: GROOMING_COUPON_POINTS,
        balanceAfter: ledger.balanceAfter,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof CouponServiceError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

export async function verifyCouponAtStore(
  rawCode: string,
  verifyingStoreId: string,
  now = new Date(),
): Promise<CouponVerifyResult> {
  const verifyingStore = await resolvePartnerStoreBySlug(verifyingStoreId);
  if (!verifyingStore) {
    return { ok: false, error: '❌ 請選擇有效的合作店家' };
  }

  const couponCode = normalizeCouponCode(rawCode);
  const row = await prisma.groomingCoupon.findUnique({
    where: { couponCode },
    include: { customer: { select: { name: true } } },
  });

  if (!row) {
    return { ok: false, error: '❌ 找不到此優惠券，請確認優惠碼是否正確' };
  }

  const coupon = toCouponView(row);

  if (row.status === 'redeemed') {
    return {
      ok: false,
      error: '❌ 此優惠券已使用',
      coupon,
    };
  }

  if (row.status === 'expired' || isCouponExpired(row, now)) {
    if (row.status === 'available') {
      await prisma.groomingCoupon.update({
        where: { id: row.id },
        data: { status: 'expired' },
      });
      coupon.status = 'expired';
    }
    return { ok: false, error: '❌ 此優惠券已過期', coupon };
  }

  if (row.storeId !== verifyingStore.slug) {
    return {
      ok: false,
      error: `❌ 此優惠券屬於：${row.storeName}\n不可於本店使用`,
      coupon,
    };
  }

  return {
    ok: true,
    coupon,
    customerName: row.customer.name,
  };
}

export async function confirmCouponRedemptionAtStore(
  rawCode: string,
  verifyingStoreId: string,
  redeemedBy?: string | null,
  now = new Date(),
): Promise<CouponRedeemStoreResult> {
  const verify = await verifyCouponAtStore(rawCode, verifyingStoreId, now);
  if (!verify.ok) {
    return { ok: false, error: verify.error, coupon: verify.coupon };
  }

  const verifyingStore = await resolvePartnerStoreBySlug(verifyingStoreId);
  const couponCode = normalizeCouponCode(rawCode);
  const row = await prisma.groomingCoupon.update({
    where: { couponCode },
    data: {
      status: 'redeemed',
      redeemedAt: now,
      redeemedStore: verifyingStore?.name ?? verify.coupon.storeName,
      redeemedBy: redeemedBy?.trim() || null,
    },
    include: { customer: { select: { name: true } } },
  });

  return { ok: true, coupon: toCouponView(row) };
}

export type StoreRedemptionReportRow = {
  storeId: string;
  storeName: string;
  redeemedCount: number;
  totalPayable: number;
};

export type StoreRedemptionDetailRow = {
  couponCode: string;
  storeId: string;
  storeName: string;
  redeemedAt: Date;
  discountAmount: number;
  redeemedBy: string | null;
};

export type StoreRedemptionReportFilter = {
  redeemedFrom?: Date;
  redeemedTo?: Date;
  storeId?: string;
};

function buildRedeemedCouponWhere(filter?: StoreRedemptionReportFilter): Prisma.GroomingCouponWhereInput {
  const where: Prisma.GroomingCouponWhereInput = { status: 'redeemed' };
  if (filter?.storeId) {
    where.storeId = filter.storeId;
  }
  if (filter?.redeemedFrom || filter?.redeemedTo) {
    where.redeemedAt = {};
    if (filter.redeemedFrom) where.redeemedAt.gte = filter.redeemedFrom;
    if (filter.redeemedTo) where.redeemedAt.lte = filter.redeemedTo;
  }
  return where;
}

export async function getStoreRedemptionReport(
  filter?: StoreRedemptionReportFilter,
): Promise<StoreRedemptionReportRow[]> {
  const grouped = await prisma.groomingCoupon.groupBy({
    by: ['storeId', 'storeName'],
    where: buildRedeemedCouponWhere(filter),
    _count: { _all: true },
    _sum: { discountAmount: true },
    orderBy: { storeName: 'asc' },
  });

  return grouped.map((g) => ({
    storeId: g.storeId,
    storeName: g.storeName,
    redeemedCount: g._count._all,
    totalPayable: Number(g._sum.discountAmount ?? 0),
  }));
}

export async function listStoreRedemptionDetails(
  filter?: StoreRedemptionReportFilter,
): Promise<StoreRedemptionDetailRow[]> {
  const rows = await prisma.groomingCoupon.findMany({
    where: buildRedeemedCouponWhere(filter),
    select: {
      couponCode: true,
      storeId: true,
      storeName: true,
      redeemedAt: true,
      discountAmount: true,
      redeemedBy: true,
    },
    orderBy: [{ redeemedAt: 'desc' }, { couponCode: 'asc' }],
  });

  return rows.map((row) => ({
    couponCode: row.couponCode,
    storeId: row.storeId,
    storeName: row.storeName,
    redeemedAt: row.redeemedAt!,
    discountAmount: Number(row.discountAmount),
    redeemedBy: row.redeemedBy,
  }));
}

class CouponServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'CouponServiceError';
  }
}

export type { Prisma };
