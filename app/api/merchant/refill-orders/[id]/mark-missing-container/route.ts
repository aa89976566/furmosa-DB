import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { markMissingContainer } from '@/lib/refill/merchant';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRefillMerchantSession();
    const body = (await req.json()) as { choice?: 'keep' | 'topup' };
    if (body.choice !== 'keep' && body.choice !== 'topup') {
      return NextResponse.json(
        { error: '請選擇「保留下次領取」或「線上補付」。' },
        { status: 400 },
      );
    }
    const result = await markMissingContainer({
      orderId: params.id,
      merchantId: session.merchantId,
      actorId: session.merchantUserId,
      choice: body.choice,
    });
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
