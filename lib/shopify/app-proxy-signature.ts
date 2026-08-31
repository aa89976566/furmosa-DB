import { createHmac, timingSafeEqual } from 'node:crypto';

/** Server-only verification for the read-only storefront directory route.
 * Does not authenticate a customer, verify a request body, or prevent replay.
 * Never use ECPay/webhook keys here.
 * Protocol: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 */
export function verifyAppProxyQuery(query: string, config: {
  appSecret: string; expectedShop: string; nowSeconds: number;
}): boolean {
  if (!config.appSecret || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.expectedShop) ||
      !Number.isFinite(config.nowSeconds) || query.length > 8192) return false;
  const params = new URLSearchParams(query);
  const entries = Array.from(params.entries());
  if (entries.length > 64) return false;
  // Singleton fields must not admit alternate interpretations by downstream handlers.
  for (const key of ['signature', 'shop', 'timestamp', 'path_prefix', 'logged_in_customer_id']) {
    if (params.getAll(key).length !== 1) return false;
  }
  for (const key of ['q', 'storeId', 'temperature']) if (params.getAll(key).length > 1) return false;
  const signature = params.get('signature')!;
  const timestamp = params.get('timestamp')!;
  if (!/^[a-f0-9]{64}$/i.test(signature) || !/^\d{1,12}$/.test(timestamp) ||
      params.get('shop') !== config.expectedShop || !/^\/apps\/[a-z0-9_-]+$/.test(params.get('path_prefix')!)) return false;
  const age = config.nowSeconds - Number(timestamp);
  if (age > 300 || age < -30) return false;
  params.delete('signature');
  const grouped = new Map<string, string[]>();
  for (const [key, value] of params) {
    const values = grouped.get(key) ?? [];
    values.push(value); grouped.set(key, values);
  }
  const message = Array.from(grouped, ([key, values]) => `${key}=${values.join(',')}`).sort().join('');
  const expected = createHmac('sha256', config.appSecret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
