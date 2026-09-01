import { parseSourceUpdatedAt } from '@/lib/shopify/event-version';
import { syncShopifyOrder, type ShopifySyncResult } from '@/lib/shopify/order-sync';
import {
  parseShopifyFulfillmentPayload,
  parseShopifyOrderPayload,
  parseShopifyRefundPayload,
} from '@/lib/shopify/payload-parse';
import {
  syncShopifyCancellation,
  syncShopifyFulfillment,
  syncShopifyRefund,
} from '@/lib/shopify/shipment-events';
import { isShopifyWebhookError } from '@/lib/shopify/webhook-errors';
import type { ShopifyWebhookDb } from '@/lib/shopify/webhook-store';
import {
  verifyShopifyWebhookIngress,
  type ShopifyWebhookTopic,
} from '@/lib/shopify/webhook-verify';

export type ShopifyWebhookHttpDeps = {
  db?: ShopifyWebhookDb;
  sleep?: (ms: number) => Promise<void>;
  secret?: string;
  expectedShopDomain?: string;
  skipSideEffects?: boolean;
};

export type ShopifyWebhookHttpResult = {
  status: number;
  body: Record<string, unknown>;
  sync?: ShopifySyncResult;
};

function logWebhookFailure(topic: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Shopify webhook failed';
  console.error('Shopify webhook failed', { topic, message });
}

function syncBody(result: ShopifySyncResult) {
  return {
    ok: true,
    ignored: result.ignored,
    created: result.created,
    updated: result.updated,
    decision: result.decision,
    orderId: result.order?.id ?? null,
  };
}

async function dispatchVerifiedWebhook(
  verified: ReturnType<typeof verifyShopifyWebhookIngress>,
  deps: ShopifyWebhookHttpDeps,
): Promise<ShopifySyncResult> {
  if (
    verified.topic === 'orders/create' ||
    verified.topic === 'orders/paid' ||
    verified.topic === 'orders/updated'
  ) {
    return syncShopifyOrder({
      topic: verified.topic,
      shopDomain: verified.shopDomain,
      webhookId: verified.webhookId,
      order: parseShopifyOrderPayload(verified.payload),
      db: deps.db,
      sleep: deps.sleep,
    });
  }
  if (verified.topic === 'orders/cancelled') {
    const order = parseShopifyOrderPayload(verified.payload);
    return syncShopifyCancellation({
      topic: verified.topic,
      shopDomain: verified.shopDomain,
      webhookId: verified.webhookId,
      orderId: String(order.id),
      sourceUpdatedAt: parseSourceUpdatedAt(order.updated_at ?? order.cancelled_at),
      db: deps.db,
      sleep: deps.sleep,
    });
  }
  if (verified.topic === 'fulfillments/create' || verified.topic === 'fulfillments/update') {
    return syncShopifyFulfillment({
      topic: verified.topic,
      shopDomain: verified.shopDomain,
      webhookId: verified.webhookId,
      fulfillment: parseShopifyFulfillmentPayload(verified.payload),
      db: deps.db,
      sleep: deps.sleep,
    });
  }
  if (verified.topic !== 'refunds/create') {
    throw new Error('Shopify webhook topic 不符');
  }
  return syncShopifyRefund({
    topic: verified.topic,
    shopDomain: verified.shopDomain,
    webhookId: verified.webhookId,
    refund: parseShopifyRefundPayload(verified.payload),
    db: deps.db,
    sleep: deps.sleep,
  });
}

export async function processShopifyWebhook(
  request: Request,
  expectedTopic: ShopifyWebhookTopic,
  deps: ShopifyWebhookHttpDeps = {},
): Promise<ShopifyWebhookHttpResult> {
  const rawBody = await request.text();
  try {
    const verified = verifyShopifyWebhookIngress({
      rawBody,
      headers: request.headers,
      expectedTopic,
      secret: deps.secret ?? process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ?? '',
      expectedShopDomain: deps.expectedShopDomain ?? process.env.SHOPIFY_SHOP_DOMAIN?.trim() ?? '',
    });
    const sync = await dispatchVerifiedWebhook(verified, deps);
    return {
      status: 200,
      body: syncBody(sync),
      sync,
    };
  } catch (error) {
    if (isShopifyWebhookError(error)) {
      if (error.retryable) {
        logWebhookFailure(expectedTopic, error);
      }
      return {
        status: error.status,
        body: { error: error.message },
      };
    }
    logWebhookFailure(expectedTopic, error);
    const message = error instanceof Error ? error.message : 'Shopify webhook 處理失敗';
    return {
      status: 500,
      body: { error: message },
    };
  }
}
