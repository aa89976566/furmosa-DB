import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { completeRefillDelivery } from '@/lib/refill/merchant';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requireRefillMerchantSession();
    const body = (await req.json()) as {
      flavourId?: string;
      quantity?: number;
      emptyJarConfirmed?: boolean;
    };
    const result = await completeRefillDelivery({
      orderId: params.id,
      merchantId: session.merchantId,
      actorId: session.merchantUserId,
      flavourId: body.flavourId ?? '',
      quantity: body.quantity ?? 0,
      emptyJarConfirmed: body.emptyJarConfirmed === true,
    });
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
