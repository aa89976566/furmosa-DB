import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { quoteRefillFulfillment } from '@/lib/refill/fulfillment-service';
import { RefillError, toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

const schema = z.object({
  pickupQuantity: z.number().int().min(1).max(100),
  returnedQuantity: z.number().int().min(0).max(100),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRefillMerchantSession();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new RefillError('請重新確認領取與歸還數量。', 'INVALID_INPUT', 400);
    }
    const quote = await quoteRefillFulfillment({
      orderId: params.id,
      merchantId: session.merchantId,
      ...parsed.data,
    });
    return NextResponse.json({ quote });
  } catch (error) {
    const { status, body } = toRefillHttp(error);
    return NextResponse.json(body, { status });
  }
}
