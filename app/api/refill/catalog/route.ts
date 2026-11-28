import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { toRefillHttp } from '@/lib/refill/errors';
import { getRefillPreorderCatalog } from '@/lib/refill/preorder-catalog';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    const customer = await requireRefillCustomer(idToken ?? '');
    const catalog = await getRefillPreorderCatalog(customer.customerId);
    return NextResponse.json(catalog);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
