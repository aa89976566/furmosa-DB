import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { initiateRefillPayment } from '@/lib/refill/payment';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await Promise.resolve(params);
    const body = (await req.json()) as { idToken?: string };
    const customer = await requireRefillCustomer(body.idToken ?? '');
    const result = await initiateRefillPayment({
      orderId: id,
      customerId: customer.customerId,
      purpose: 'refill',
    });
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
