import { createHmac, timingSafeEqual } from 'node:crypto';
import { ShopifyWebhookClientError } from '@/lib/shopify/webhook-errors';

export const SHOPIFY_WEBHOOK_TOPICS = [
  'orders/create',
  'orders/paid',
  'orders/updated',
  'orders/cancelled',
  'refunds/create',
  'fulfillments/create',
  'fulfillments/update',
] as const;

export type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];

export type ShopifyWebhookHeaders = {
  hmac: string;
  topic: string;
  shopDomain: string;
  webhookId: string;
};

export type VerifiedShopifyWebhook = {
  shopDomain: string;
  webhookId: string;
  topic: ShopifyWebhookTopic;
  payload: Record<string, unknown>;
};

const TOPIC_SET = new Set<string>(SHOPIFY_WEBHOOK_TOPICS);

export function isShopifyWebhookTopic(value: string): value is ShopifyWebhookTopic {
  return TOPIC_SET.has(value);
}

export function normalizeShopifyShopDomain(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function verifyShopifyWebhookHmac(rawBody: string, received: string, secret: string) {
  if (!received || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(received, 'base64');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function readShopifyWebhookHeaders(headers: Headers): ShopifyWebhookHeaders {
  return {
    hmac: headers.get('x-shopify-hmac-sha256') ?? '',
    topic: headers.get('x-shopify-topic') ?? '',
    shopDomain: normalizeShopifyShopDomain(headers.get('x-shopify-shop-domain')),
    webhookId: headers.get('x-shopify-webhook-id')?.trim() ?? '',
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseShopifyWebhookJson(rawBody: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ShopifyWebhookClientError('Shopify webhook JSON 格式錯誤');
  }
  if (!isPlainRecord(parsed)) {
    throw new ShopifyWebhookClientError('Shopify webhook JSON 格式錯誤');
  }
  return parsed;
}

export function verifyShopifyWebhookIngress(input: {
  rawBody: string;
  headers: Headers;
  expectedTopic: ShopifyWebhookTopic;
  secret: string;
  expectedShopDomain?: string;
}): VerifiedShopifyWebhook {
  const headers = readShopifyWebhookHeaders(input.headers);
  if (!verifyShopifyWebhookHmac(input.rawBody, headers.hmac, input.secret)) {
    throw new ShopifyWebhookClientError('Shopify webhook 驗證失敗', 401);
  }
  if (!headers.topic || headers.topic !== input.expectedTopic) {
    throw new ShopifyWebhookClientError('Shopify webhook topic 不符');
  }
  if (!isShopifyWebhookTopic(headers.topic)) {
    throw new ShopifyWebhookClientError('Shopify webhook topic 不符');
  }
  if (!headers.shopDomain) {
    throw new ShopifyWebhookClientError('Shopify 商店來源不符', 403);
  }
  const expectedShop = normalizeShopifyShopDomain(input.expectedShopDomain);
  if (expectedShop && headers.shopDomain !== expectedShop) {
    throw new ShopifyWebhookClientError('Shopify 商店來源不符', 403);
  }
  return {
    shopDomain: headers.shopDomain,
    webhookId: headers.webhookId,
    topic: headers.topic,
    payload: parseShopifyWebhookJson(input.rawBody),
  };
}
