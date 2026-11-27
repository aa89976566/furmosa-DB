import { createHash } from 'node:crypto';
import type { PostHog } from 'posthog-node';

export type FurmosaAnalyticsEvent =
  | 'line_shop_home_opened' | 'line_shop_category_viewed'
  | 'line_shop_product_viewed' | 'line_shop_cart_viewed'
  | 'line_shop_item_added' | 'line_shop_checkout_started'
  | 'line_shop_order_created' | 'line_shop_payment_reference_submitted'
  | 'line_shop_error';

type AnalyticsValue = string | number | boolean | null;
const BLOCKED_PROPERTY_KEYS = /(^|_)(address|email|error_message|last5|line_user_id|name|note|phone|recipient|token)($|_)/i;
let clientPromise: Promise<PostHog | null> | undefined;

async function getClient() {
  if (clientPromise) return clientPromise;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  clientPromise = token && host
    ? import('posthog-node').then(({ PostHog: Client }) => new Client(token, { host, flushAt: 1, flushInterval: 0 }))
    : Promise.resolve(null);
  if ((!token || !host) && process.env.NODE_ENV === 'development') {
    console.warn('[analytics] PostHog server capture is disabled because configuration is missing.');
  }
  return clientPromise;
}

export function analyticsDistinctId(lineUserId: string) {
  return createHash('sha256').update(`furmosa-line:${lineUserId}`).digest('hex');
}

export function sanitizeAnalyticsProperties(properties: Record<string, AnalyticsValue>) {
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !BLOCKED_PROPERTY_KEYS.test(key)));
}

export async function captureLineShopEvent(
  lineUserId: string,
  event: FurmosaAnalyticsEvent,
  properties: Record<string, AnalyticsValue> = {},
) {
  const posthog = await getClient();
  if (!posthog) return;
  try {
    posthog.capture({
      distinctId: analyticsDistinctId(lineUserId),
      event,
      properties: { ...sanitizeAnalyticsProperties(properties), source: 'line_bot' },
    });
    await posthog.flush();
  } catch (error) {
    console.warn('[analytics] PostHog capture failed', error instanceof Error ? error.name : 'unknown');
  }
}
