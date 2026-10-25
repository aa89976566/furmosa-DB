type ShopifyAdminTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

export type ShopifyAdminAuthConfig = {
  domain: string;
  clientId?: string;
  clientSecret?: string;
  staticToken?: string;
};

export class ShopifyAdminAuthError extends Error {}

const tokenCache = new Map<string, TokenCacheEntry>();
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new ShopifyAdminAuthError('尚未設定有效的 Shopify 商店網域');
  }
  return domain;
}

export function shopifyAdminAuthConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ShopifyAdminAuthConfig {
  return {
    domain: env.SHOPIFY_SHOP_DOMAIN ?? '',
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
    staticToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  };
}

export async function getShopifyAdminAccessToken(
  config: ShopifyAdminAuthConfig,
  request: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<string> {
  const domain = normalizeDomain(config.domain);
  const clientId = config.clientId?.trim() ?? '';
  const clientSecret = config.clientSecret?.trim() ?? '';

  // Client credentials are the primary production flow. A static token remains
  // available only for older environments that have not migrated yet.
  if (!clientId && !clientSecret) {
    const staticToken = config.staticToken?.trim() ?? '';
    if (!staticToken) throw new ShopifyAdminAuthError('尚未設定 Shopify 管理 API 憑證');
    return staticToken;
  }
  if (!clientId || !clientSecret) {
    throw new ShopifyAdminAuthError('Shopify Client ID 與 Client Secret 必須同時設定');
  }

  const cacheKey = `${domain}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now()) return cached.token;

  let response: Response;
  try {
    response = await request(`https://${domain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ShopifyAdminAuthError('Shopify 授權服務連線失敗，尚未執行同步');
  }

  if (response.status === 429) throw new ShopifyAdminAuthError('Shopify 暫時限制授權請求，請稍後再試');
  if (response.status === 401 || response.status === 403) {
    throw new ShopifyAdminAuthError('Shopify Client ID 或 Client Secret 無法通過授權');
  }
  if (!response.ok) throw new ShopifyAdminAuthError(`Shopify 授權失敗（HTTP ${response.status}）`);

  let payload: ShopifyAdminTokenResponse;
  try {
    payload = await response.json() as ShopifyAdminTokenResponse;
  } catch {
    throw new ShopifyAdminAuthError('Shopify 授權回傳格式不完整');
  }
  const token = typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : Number(payload.expires_in);
  if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new ShopifyAdminAuthError('Shopify 授權回傳格式不完整');
  }

  tokenCache.set(cacheKey, { token, expiresAt: now() + expiresIn * 1000 });
  return token;
}

export function clearShopifyAdminTokenCacheForTests() {
  tokenCache.clear();
}
