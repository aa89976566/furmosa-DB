import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { getRefillEligibility } from '@/lib/refill/service';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idToken?: string;
      appointmentId?: string;
      storeId?: string;
    };
    const customer = await requireRefillCustomer(body.idToken ?? '');
    const data = await getRefillEligibility({
      customerId: customer.customerId,
      customerName: customer.name,
      appointmentId: body.appointmentId,
      storeId: body.storeId,
    });
    return NextResponse.json(data);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
