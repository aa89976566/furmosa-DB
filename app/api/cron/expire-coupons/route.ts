import { NextResponse } from 'next/server';
import { expireCoupons } from '@/lib/coupons/service';

export const dynamic = 'force-dynamic';

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/** 每日凌晨將過期優惠券標記為 expired */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const count = await expireCoupons();
  return NextResponse.json({ ok: true, expired: count });
}

export async function POST(req: Request) {
  return GET(req);
}
