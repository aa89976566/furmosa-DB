import { NextResponse } from 'next/server';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosEconomics } from '@/lib/finance/pos-economics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await requireMerchantSession();
  const requested = new URL(request.url).searchParams.get('merchantId');
  const payload = await loadPosEconomics(session.merchantId, requested);
  if (payload.merchantId !== session.merchantId) {
    return NextResponse.json({ error: '無權存取此店家資料' }, { status: 403 });
  }
  return NextResponse.json(payload);
}
