import { NextResponse } from 'next/server';
import {
  importShopifyPaidOrder,
  type ShopifyPaidOrder,
  verifyShopifyWebhookHmac,
} from '@/lib/shopify/orders-paid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';
  const rawBody = await req.text();
  const hmac = req.headers.get('x-shopify-hmac-sha256') ?? '';
  if (!verifyShopifyWebhookHmac(rawBody, hmac, secret)) {
    return NextResponse.json({ error: 'invalid webhook signature' }, { status: 401 });
  }

  const topic = req.headers.get('x-shopify-topic') ?? '';
  if (topic && topic !== 'orders/paid') {
    return NextResponse.json({ error: 'invalid webhook topic' }, { status: 400 });
  }

  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? '';
  try {
    const payload = JSON.parse(rawBody) as ShopifyPaidOrder;
    const result = await importShopifyPaidOrder(shopDomain, payload);
    return NextResponse.json(
      { ok: true, created: result.created, orderId: result.order.id },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error('[shopify.orders-paid]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Shopify 訂單匯入失敗' },
      { status: 422 },
    );
  }
}
