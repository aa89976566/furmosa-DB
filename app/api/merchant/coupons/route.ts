import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMerchantSessionFromCookies } from '@/lib/merchant-auth/session';
import { prisma } from '@/lib/prisma';
import {
  confirmCouponRedemptionAtStore,
  verifyCouponAtStore,
} from '@/lib/coupons/service';
import { normalizeCouponCode } from '@/lib/coupons/codes';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['verify', 'redeem']),
  couponCode: z.string().trim().min(1).max(64),
});

async function context() {
  const session = await getMerchantSessionFromCookies();
  if (!session) return null;
  const store = await resolveCouponStoreForMerchant(session.merchantId);
  if (!store) return { session, store: null };
  return { session, store };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ ok: false, error: '請先登入 POS' }, { status: 401 });
  if (!ctx.store) {
    return NextResponse.json({ ok: false, error: '此店家尚未完成美容券綁定' }, { status: 403 });
  }

  const rows = await prisma.groomingCoupon.findMany({
    where: { storeId: ctx.store.storeSlug, status: 'redeemed' },
    orderBy: { redeemedAt: 'desc' },
    take: 20,
    select: {
      couponCode: true,
      discountAmount: true,
      redeemedAt: true,
      redeemedBy: true,
      customer: { select: { name: true } },
    },
  });
  return NextResponse.json({
    ok: true,
    storeName: ctx.store.storeName,
    rows: rows.map((row) => ({ ...row, customerName: row.customer.name })),
  });
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ ok: false, error: '請先登入 POS' }, { status: 401 });
  if (!ctx.store) {
    return NextResponse.json({ ok: false, error: '此店家尚未完成美容券綁定' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: '請輸入正確的折價券序號' }, { status: 400 });
  }
  const code = normalizeCouponCode(parsed.data.couponCode);
  const result = parsed.data.action === 'verify'
    ? await verifyCouponAtStore(code, ctx.store.storeSlug)
    : await confirmCouponRedemptionAtStore(
        code,
        ctx.store.storeSlug,
        ctx.session.username,
      );
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
