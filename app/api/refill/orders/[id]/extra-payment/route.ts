import { NextResponse } from 'next/server';
import { requireRefillCustomer } from '@/lib/refill/auth-customer';
import { initiateRefillPayment } from '@/lib/refill/payment';
import { toRefillHttp } from '@/lib/refill/errors';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await Promise.resolve(params);
    const body = (await req.json()) as { idToken?: string };
    const customer = await requireRefillCustomer(body.idToken ?? '');
    const preparedFulfillmentTopUp = await prisma.paymentOrder.findFirst({
      where: {
        refillOrderId: id,
        purpose: 'fulfillment_topup',
        status: 'pending',
      },
      select: { id: true },
    });
    const result = await initiateRefillPayment({
      orderId: id,
      customerId: customer.customerId,
      purpose: preparedFulfillmentTopUp ? 'fulfillment_topup' : 'extra_topup',
    });
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
