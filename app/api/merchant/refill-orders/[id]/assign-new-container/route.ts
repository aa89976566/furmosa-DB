import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { assignNewAndComplete } from '@/lib/refill/merchant';
import { toRefillHttp } from '@/lib/refill/errors';

export const dynamic = 'force-dynamic';

/** 綁定新罐並完成交付（與 complete 相同 transaction） */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRefillMerchantSession();
    const body = (await req.json()) as { serial?: string; oldSerial?: string };
    const result = await assignNewAndComplete({
      orderId: params.id,
      merchantId: session.merchantId,
      actorId: session.merchantUserId,
      newSerialRaw: body.serial ?? '',
      oldSerialRaw: body.oldSerial,
    });
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
