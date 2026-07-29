import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await requireRefillMerchantSession();
    const orders = await listMerchantRefillOrders(session.merchantId);
    return NextResponse.json({ orders });
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
