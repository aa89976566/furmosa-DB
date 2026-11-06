import { NextResponse } from 'next/server';
import { legacyMerchantSerialFlowResult } from '@/lib/refill/legacy-merchant-flow';

export const dynamic = 'force-dynamic';

/** @deprecated 店員不再輸入新罐序號。 */
export async function POST() {
  const result = legacyMerchantSerialFlowResult();
  return NextResponse.json(result.body, { status: result.status });
}
