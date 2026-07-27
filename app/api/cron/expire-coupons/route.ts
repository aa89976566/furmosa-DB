import { NextResponse } from 'next/server';
import { expireCoupons } from '@/lib/coupons/service';
import { authorizeCronRequest } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/** 每日凌晨將過期優惠券標記為 expired */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const count = await expireCoupons();
  return NextResponse.json({ ok: true, expired: count });
}

export async function POST(req: Request) {
  return GET(req);
}
