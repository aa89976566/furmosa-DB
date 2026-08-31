import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchDirectory } from '@/lib/logistics/ecpay-directory';
import { createSearchService } from '@/lib/logistics/search-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Authenticated HQ preview only. Do not whitelist this path in middleware.
// Production deployment stays disabled. Live directory reads require explicit opt-in.
function liveDirectory() {
  return process.env.PICKUP_DIRECTORY_SOURCE === 'live-readonly';
}
const search = createSearchService({
  now: Date.now,
  enabled: () => process.env.VERCEL_ENV === 'preview' && process.env.PICKUP_SEARCH_PREVIEW_ENABLED === 'true' &&
    (!process.env.PICKUP_DIRECTORY_SOURCE || ['stage', 'live-readonly'].includes(process.env.PICKUP_DIRECTORY_SOURCE)),
  frozenConfirmed: () => false,
  load: service => fetchDirectory({
    merchantId: (liveDirectory() ? process.env.ECPAY_LOGISTICS_LIVE_MERCHANT_ID : process.env.ECPAY_LOGISTICS_TEST_MERCHANT_ID) ?? '',
    hashKey: (liveDirectory() ? process.env.ECPAY_LOGISTICS_LIVE_HASH_KEY : process.env.ECPAY_LOGISTICS_TEST_HASH_KEY) ?? '',
    hashIV: (liveDirectory() ? process.env.ECPAY_LOGISTICS_LIVE_HASH_IV : process.env.ECPAY_LOGISTICS_TEST_HASH_IV) ?? '',
    environment: liveDirectory() ? 'production' : 'stage',
  }, service, { fetch, now: Date.now }),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const result = await search(Boolean(user), request.nextUrl.searchParams.get('q') ?? '', request.nextUrl.searchParams.get('temperature') ?? 'ambient', request.nextUrl.searchParams.get('storeId') ?? undefined);
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
}
