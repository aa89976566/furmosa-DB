import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAppProxyQuery } from '@/lib/shopify/app-proxy-signature';
import { parseProductWish } from '@/lib/product-wishes/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function productWishesEnabled() {
  if (process.env.VERCEL_ENV === 'production') {
    return process.env.SHOPIFY_APP_PROXY_ENABLED === 'true' &&
      process.env.SHOPIFY_PRODUCT_WISHES_ENABLED === 'true';
  }
  return process.env.VERCEL_ENV === 'preview' &&
    process.env.SHOPIFY_APP_PROXY_PREVIEW_ENABLED === 'true' &&
    process.env.SHOPIFY_PRODUCT_WISHES_PREVIEW_ENABLED === 'true';
}

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(request: NextRequest) {
  const rawQuery = request.url.split('?', 2)[1] ?? '';
  const allowed = productWishesEnabled() &&
    verifyAppProxyQuery(rawQuery, {
      appSecret: process.env.SHOPIFY_APP_PROXY_SECRET ?? '',
      expectedShop: process.env.SHOPIFY_APP_PROXY_SHOP ?? '',
      nowSeconds: Math.floor(Date.now() / 1000),
    });

  if (!allowed) return response({ error: '目前無法送出許願' }, 401);

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > 4096) {
    return response({ error: '需求內容過長，請縮短後再試一次' }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: '請填寫想找的東西' }, 400);
  }

  const parsed = parseProductWish(body);
  if (!parsed.ok) return response({ error: parsed.error }, 400);

  const wish = await prisma.productWish.create({
    data: {
      species: parsed.value.species,
      requestText: parsed.value.requestText,
      intent: parsed.value.intent ?? null,
      context: { entry: 'smart_guide_no_match' },
    },
    select: { id: true },
  });

  return response({ ok: true, id: wish.id }, 201);
}
