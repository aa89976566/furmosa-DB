import { NextResponse } from 'next/server';

/** Legacy public coupon verify/redeem entry — permanently retired (410 Gone). */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: '此核銷入口已停用' },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
