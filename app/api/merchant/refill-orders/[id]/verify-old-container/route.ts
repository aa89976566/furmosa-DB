import { NextResponse } from 'next/server';
import { legacyMerchantSerialFlowResult } from '@/lib/refill/legacy-merchant-flow';

export const dynamic = 'force-dynamic';

/** @deprecated 店員只需勾選已收到實體空罐。 */
export async function POST() {
  const result = legacyMerchantSerialFlowResult();
  return NextResponse.json(result.body, { status: result.status });
}
