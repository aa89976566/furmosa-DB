import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { sendNewOrderPush } from '@/lib/web-push';
import {
  processShopifyWebhook,
  type ShopifyWebhookHttpDeps,
} from '@/lib/shopify/webhook-process';
import type { ShopifyWebhookTopic } from '@/lib/shopify/webhook-verify';
import { orderWebhook } from '@/lib/shopify/webhook-runtime';

export { processShopifyWebhook } from '@/lib/shopify/webhook-process';
export type { ShopifyWebhookHttpDeps, ShopifyWebhookHttpResult } from '@/lib/shopify/webhook-process';

function revalidateShopifySurfaces(topic: ShopifyWebhookTopic) {
  revalidatePath('/orders');
  revalidatePath('/reviews');
  revalidatePath('/dashboard');
  if (
    topic === 'orders/create' ||
    topic === 'orders/cancelled' ||
    topic === 'fulfillments/create' ||
    topic === 'fulfillments/update'
  ) {
    revalidatePath('/shipments');
  }
}

export async function handleShopifyWebhookRoute(
  request: Request,
  expectedTopic: ShopifyWebhookTopic,
  deps: ShopifyWebhookHttpDeps = {},
) {
  // The HQ OMS intake is the production order-ingress path: it stores every
  // Shopify order snapshot before product matching or fulfillment. The
  // injectable processor below remains available for isolated sync tests and
  // the non-order lifecycle webhooks added by the hardened webhook layer.
  if (
    Object.keys(deps).length === 0 &&
    (expectedTopic === 'orders/create' ||
      expectedTopic === 'orders/paid' ||
      expectedTopic === 'orders/updated')
  ) {
    return orderWebhook(expectedTopic)(request);
  }
  const result = await processShopifyWebhook(request, expectedTopic, deps);
  if (result.status >= 200 && result.status < 300 && !deps.skipSideEffects) {
    revalidateShopifySurfaces(expectedTopic);
    if (result.sync?.created && result.sync.order) {
      void sendNewOrderPush({
        id: result.sync.order.id,
        orderNumber: result.sync.order.orderNumber,
        total: Number(result.sync.order.total),
        source: result.sync.order.source,
        needsReview: true,
      });
    }
  }
  return NextResponse.json(result.body, { status: result.status });
}
