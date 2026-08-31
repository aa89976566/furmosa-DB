import { createHash } from 'node:crypto';
import { shopifySnapshot, verifyIntakeSignature, type ShopifyOrderTopic } from './intake-policy';
import type { IntakeEvent, persistShopifyIntake } from './intake';

type IntakeResult = Awaited<ReturnType<typeof persistShopifyIntake>>;
export function shopifyWebhookHandler(topic: ShopifyOrderTopic, dependencies: {
  secret: () => string; domain: () => string;
  persist: (event: IntakeEvent) => Promise<IntakeResult>;
  onSaved?: (result: IntakeResult, event: IntakeEvent) => void;
  logError?: (code: string) => void;
}) {
  return async (request: Request) => {
    const secret = dependencies.secret().trim();
    const allowedDomain = dependencies.domain().trim().toLowerCase();
    if (!secret || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(allowedDomain)) {
      return Response.json({ error: 'SHOPIFY_NOT_CONFIGURED' }, { status: 503 });
    }
    const body = await request.text();
    if (!verifyIntakeSignature(body, request.headers.get('x-shopify-hmac-sha256') ?? '', secret)) {
      return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
    }
    if (request.headers.get('x-shopify-topic') !== topic) {
      return Response.json({ error: 'INVALID_TOPIC' }, { status: 400 });
    }
    const shopDomain = request.headers.get('x-shopify-shop-domain')?.trim().toLowerCase() ?? '';
    if (shopDomain !== allowedDomain) return Response.json({ error: 'INVALID_SHOP' }, { status: 403 });
    let snapshot;
    try { snapshot = shopifySnapshot(JSON.parse(body)); }
    catch { return Response.json({ error: 'INVALID_ORDER_PAYLOAD' }, { status: 400 }); }
    const eventId = request.headers.get('x-shopify-event-id')?.trim() ||
      request.headers.get('x-shopify-webhook-id')?.trim() ||
      `body:${createHash('sha256').update(body).digest('hex')}`;
    try {
      const event = { shopDomain, topic, eventId, snapshot };
      const result = await dependencies.persist(event);
      try { dependencies.onSaved?.(result, event); } catch { dependencies.logError?.('POST_INTAKE_NOTIFICATION_FAILED'); }
      return Response.json({ ok: true, created: result.created, disposition: result.disposition });
    } catch (error) {
      const code = error instanceof Error && error.message === 'EVENT_ID_CONFLICT' ? 'EVENT_ID_CONFLICT' : 'INTAKE_FAILED';
      dependencies.logError?.(code);
      return Response.json({ error: code }, { status: code === 'EVENT_ID_CONFLICT' ? 409 : 503 });
    }
  };
}
