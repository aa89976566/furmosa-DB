import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import { toRefillHttp } from '@/lib/refill/errors';
import { legacyMerchantSerialFlowResult } from '@/lib/refill/legacy-merchant-flow';

export const dynamic = 'force-dynamic';

/** @deprecated 店員不再輸入或綁定新罐序號。 */
export async function POST() {
  try {
    await requireRefillMerchantSession();
    const result = legacyMerchantSerialFlowResult();
    return NextResponse.json(result.body, {
      status: result.status,
      headers: result.headers,
    });
  } catch (error) {
    const { status, body } = toRefillHttp(error);
    return NextResponse.json(body, { status });
  }
}
