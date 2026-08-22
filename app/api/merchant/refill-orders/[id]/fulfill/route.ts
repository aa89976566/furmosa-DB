import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { completeRefillFulfillment } from '@/lib/refill/fulfillment-service';
import { parseRefillFulfillmentInput } from '@/lib/refill/fulfillment-input';
import { RefillError, toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRefillMerchantSession();
    let input;
    try {
      input = parseRefillFulfillmentInput(await req.json());
    } catch (error) {
      throw new RefillError(
        error instanceof Error ? error.message : '提交內容格式不正確。',
        'INVALID_INPUT',
        400,
      );
    }
    const result = await completeRefillFulfillment({
      orderId: params.id,
      merchantId: session.merchantId,
      operatorMerchantUserId: session.merchantUserId,
      ...input,
    });
    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const { status, body } = toRefillHttp(error);
    return NextResponse.json(body, { status });
  }
}
