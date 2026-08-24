import { createHmac, timingSafeEqual } from 'crypto';

export function shopifyWebhookHmac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

export function verifyShopifyWebhook(
  body: string,
  receivedHmac: string | null,
  secret: string,
): boolean {
  if (!receivedHmac || !secret) return false;
  const expected = Buffer.from(shopifyWebhookHmac(body, secret));
  const received = Buffer.from(receivedHmac.trim());
  return expected.length === received.length && timingSafeEqual(expected, received);
}

