import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { toRefillHttp } from '@/lib/refill/errors';
import { cancelUnpaidRefillOrder } from '@/lib/refill/service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  props: { params: Promise<Promise<{ id: string }> | { id: string }> },
) {
  const params = await props.params;
  try {
    const { id } = await Promise.resolve(params);
    const body = (await req.json()) as { idToken?: string; reason?: string };
    const customer = await requireRefillCustomer(body.idToken ?? '');
    const result = await cancelUnpaidRefillOrder({
      orderId: id,
      customerId: customer.customerId,
      reason: body.reason,
    });
    return NextResponse.json({
      ok: true,
      status: result.order.status,
      repeated: result.repeated,
      releasedJarCount: result.releasedJarCount,
    });
  } catch (error) {
    const { status, body } = toRefillHttp(error);
    return NextResponse.json(body, { status });
  }
}
