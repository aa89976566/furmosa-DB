import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { listRefillBookings } from '@/lib/refill/service';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string; storeId?: string };
    const customer = await requireRefillCustomer(body.idToken ?? '');
    const bookings = await listRefillBookings({
      customerId: customer.customerId,
      storeId: body.storeId,
    });
    return NextResponse.json({ bookings });
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
