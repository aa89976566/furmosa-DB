import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchDirectory } from '@/lib/logistics/ecpay-directory';
import { createSearchService } from '@/lib/logistics/search-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Authenticated HQ preview only. Do not whitelist this path in middleware.
// Production and live logistics access are intentionally disabled in this version.
const search = createSearchService({
  now: Date.now,
  enabled: () => process.env.VERCEL_ENV === 'preview' && process.env.PICKUP_SEARCH_PREVIEW_ENABLED === 'true',
  frozenConfirmed: () => false,
  load: service => fetchDirectory({
    merchantId: process.env.ECPAY_LOGISTICS_TEST_MERCHANT_ID ?? '',
    hashKey: process.env.ECPAY_LOGISTICS_TEST_HASH_KEY ?? '',
    hashIV: process.env.ECPAY_LOGISTICS_TEST_HASH_IV ?? '',
    environment: 'stage',
  }, service, { fetch, now: Date.now }),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const result = await search(Boolean(user), request.nextUrl.searchParams.get('q') ?? '', request.nextUrl.searchParams.get('temperature') ?? 'ambient');
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
}
