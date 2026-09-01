import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxyQuery } from '@/lib/shopify/app-proxy-signature';
import { fetchDirectory } from '@/lib/logistics/ecpay-directory';
import { createSearchService } from '@/lib/logistics/search-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function liveDirectory() {
  return process.env.PICKUP_DIRECTORY_SOURCE === 'live-readonly';
}

function storefrontEnabled() {
  if (process.env.VERCEL_ENV === 'production') {
    return process.env.SHOPIFY_APP_PROXY_ENABLED === 'true' && liveDirectory();
  }
  return process.env.VERCEL_ENV === 'preview' &&
    process.env.SHOPIFY_APP_PROXY_PREVIEW_ENABLED === 'true' &&
    process.env.PICKUP_SEARCH_PREVIEW_ENABLED === 'true' &&
    (!process.env.PICKUP_DIRECTORY_SOURCE || ['stage', 'live-readonly'].includes(process.env.PICKUP_DIRECTORY_SOURCE));
}

function frozenStorefrontEnabled() {
  return liveDirectory() && process.env.SHOPIFY_APP_PROXY_FROZEN_ENABLED === 'true';
}

const search = createSearchService({
  now: Date.now,
  enabled: storefrontEnabled,
  frozenConfirmed: frozenStorefrontEnabled,
  load: service => fetchDirectory({
    merchantId: (liveDirectory() ? process.env.ECPAY_LOGISTICS_LIVE_MERCHANT_ID : process.env.ECPAY_LOGISTICS_TEST_MERCHANT_ID) ?? '',
    hashKey: (liveDirectory() ? process.env.ECPAY_LOGISTICS_LIVE_HASH_KEY : process.env.ECPAY_LOGISTICS_TEST_HASH_KEY) ?? '',
    hashIV: (liveDirectory() ? process.env.ECPAY_LOGISTICS_LIVE_HASH_IV : process.env.ECPAY_LOGISTICS_TEST_HASH_IV) ?? '',
    environment: liveDirectory() ? 'production' : 'stage',
  }, service, { fetch, now: Date.now }),
});

export async function GET(request: NextRequest) {
  const rawQuery = request.url.split('?', 2)[1] ?? '';
  const allowed = storefrontEnabled() &&
    verifyAppProxyQuery(rawQuery, {
      appSecret: process.env.SHOPIFY_APP_PROXY_SECRET ?? '',
      expectedShop: process.env.SHOPIFY_APP_PROXY_SHOP ?? '',
      nowSeconds: Math.floor(Date.now() / 1000),
    });
  if (!allowed) {
    return NextResponse.json({ error: '目前無法查詢門市' }, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const result = await search(
    true,
    request.nextUrl.searchParams.get('q') ?? '',
    request.nextUrl.searchParams.get('temperature') ?? 'ambient',
    request.nextUrl.searchParams.get('storeId') ?? undefined,
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
