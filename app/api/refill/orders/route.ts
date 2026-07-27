import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { createRefillOrder, getRefillOrderForCustomer } from '@/lib/refill/service';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idToken?: string;
      appointmentId?: string;
      amount?: number;
      idempotencyKey?: string;
    };
    if (!body.appointmentId?.trim()) {
      return NextResponse.json({ error: '請選擇美容預約。' }, { status: 400 });
    }
    const customer = await requireRefillCustomer(body.idToken ?? '');
    const { order, reused } = await createRefillOrder({
      customerId: customer.customerId,
      appointmentId: body.appointmentId,
      clientAmount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });
    const detail = await getRefillOrderForCustomer(order.id, customer.customerId);
    return NextResponse.json({ order: detail, reused }, { status: reused ? 200 : 201 });
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
