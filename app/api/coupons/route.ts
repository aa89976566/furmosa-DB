import {
  verifyCouponAtStore,
  confirmCouponRedemptionAtStore,
} from '@/lib/coupons/service';
import { isValidPartnerStoreSlug } from '@/lib/stores/partner-stores';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      couponCode?: string;
      storeId?: string;
      redeemedBy?: string;
      action?: 'verify' | 'redeem';
    };
    const { couponCode, storeId, redeemedBy, action = 'verify' } = body;
    if (!couponCode || !storeId) {
      return NextResponse.json({ ok: false, error: '缺少 couponCode 或 storeId' }, { status: 400 });
    }
    if (!(await isValidPartnerStoreSlug(storeId))) {
      return NextResponse.json({ ok: false, error: '請選擇有效的合作店家' }, { status: 400 });
    }
    if (action === 'redeem') {
      const result = await confirmCouponRedemptionAtStore(couponCode, storeId, redeemedBy ?? null);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    const result = await verifyCouponAtStore(couponCode, storeId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '伺服器錯誤';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
