import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  importShopifyOrder,
  type ShopifyPaidOrder,
  verifyShopifyWebhookHmac,
} from '@/lib/shopify/orders-paid';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ?? '';
  const signature = request.headers.get('x-shopify-hmac-sha256') ?? '';
  if (!secret || !verifyShopifyWebhookHmac(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Shopify webhook 驗證失敗' }, { status: 401 });
  }

  const topic = request.headers.get('x-shopify-topic');
  if (topic !== 'orders/create') {
    return NextResponse.json({ error: 'Shopify webhook topic 不符' }, { status: 400 });
  }

  const shopDomain = request.headers.get('x-shopify-shop-domain')?.trim().toLowerCase() ?? '';
  const allowedDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase() ?? '';
  if (!shopDomain || (allowedDomain && shopDomain !== allowedDomain)) {
    return NextResponse.json({ error: 'Shopify 商店來源不符' }, { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody) as ShopifyPaidOrder;
    const result = await importShopifyOrder(shopDomain, payload);
    revalidatePath('/orders');
    revalidatePath('/reviews');
    revalidatePath('/dashboard');
    revalidatePath('/shipments');
    return NextResponse.json({
      ok: true,
      created: result.created,
      updated: result.updated,
      orderId: result.order.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shopify 訂單同步失敗';
    console.error('Shopify orders/create webhook failed', error);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
