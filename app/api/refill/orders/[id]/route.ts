import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { getRefillOrderForCustomer } from '@/lib/refill/service';
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
    const order = await getRefillOrderForCustomer(id, customer.customerId);
    return NextResponse.json({ order });
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
