import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncShopifyOrder, ShopifySyncError, type ShopifyOrderPayload } from '@/lib/shopify/order-sync';
import { verifyShopifyWebhook } from '@/lib/shopify/webhook';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'Shopify webhook 尚未設定' }, { status: 503 });
  }

  const body = await request.text();
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  if (!verifyShopifyWebhook(body, hmac, secret)) {
    return NextResponse.json({ error: 'Shopify webhook 簽章無效' }, { status: 401 });
  }

  const shopDomain = request.headers.get('x-shopify-shop-domain')?.trim().toLowerCase() ?? '';
  const allowedShopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase() ?? '';
  if (!shopDomain || (allowedShopDomain && shopDomain !== allowedShopDomain)) {
    return NextResponse.json({ error: 'Shopify 商店來源不符' }, { status: 403 });
  }

  const topic = request.headers.get('x-shopify-topic');
  if (topic && topic !== 'orders/create') {
    return NextResponse.json({ error: `不支援的 Shopify topic：${topic}` }, { status: 422 });
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(body) as ShopifyOrderPayload;
  } catch {
    return NextResponse.json({ error: 'Shopify JSON 格式錯誤' }, { status: 400 });
  }

  try {
    const result = await syncShopifyOrder(payload, shopDomain);
    revalidatePath('/orders');
    revalidatePath('/shipments');
    revalidatePath('/dashboard');
    await bustCacheTags(
      CACHE_TAGS.dashboard,
      CACHE_TAGS.orderHubTotals,
      CACHE_TAGS.shipmentQueueCounts,
    );
    return NextResponse.json({
      ok: true,
      status: result.created ? 'created' : 'duplicate',
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
    });
  } catch (error) {
    if (error instanceof ShopifySyncError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Shopify order webhook sync failed', error);
    return NextResponse.json({ error: 'Shopify 訂單同步失敗' }, { status: 500 });
  }
}
