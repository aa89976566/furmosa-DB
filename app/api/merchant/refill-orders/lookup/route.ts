import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { lookupRefillBySerial } from '@/lib/refill/merchant';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await requireRefillMerchantSession();
    const body = (await req.json()) as { serial?: string };
    const result = await lookupRefillBySerial(session.merchantId, body.serial ?? '');
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
