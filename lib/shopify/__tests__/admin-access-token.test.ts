import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearShopifyAdminTokenCacheForTests,
  getShopifyAdminAccessToken,
  ShopifyAdminAuthError,
} from '../admin-access-token';

const config = {
  domain: 'test-shop.myshopify.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};

test.beforeEach(() => clearShopifyAdminTokenCacheForTests());

test('exchanges client credentials without exposing them in the URL', async () => {
  let requestedUrl = '';
  let requestedBody = '';
  const token = await getShopifyAdminAccessToken(config, async (input, init) => {
    requestedUrl = String(input);
    requestedBody = String(init?.body);
    return Response.json({ access_token: 'short-lived-token', scope: 'read_products', expires_in: 86_399 });
  });
  assert.equal(token, 'short-lived-token');
  assert.equal(requestedUrl, 'https://test-shop.myshopify.com/admin/oauth/access_token');
  assert.equal(requestedUrl.includes('client-secret'), false);
  assert.deepEqual(JSON.parse(requestedBody), {
    client_id: 'client-id', client_secret: 'client-secret', grant_type: 'client_credentials',
  });
});

test('caches a token and refreshes it inside the safety margin', async () => {
  let calls = 0;
  let now = 1_000;
  const request = async () => Response.json({ access_token: `token-${++calls}`, expires_in: 600 });
  assert.equal(await getShopifyAdminAccessToken(config, request as typeof fetch, () => now), 'token-1');
  now += 60_000;
  assert.equal(await getShopifyAdminAccessToken(config, request as typeof fetch, () => now), 'token-1');
  now += 300_001;
  assert.equal(await getShopifyAdminAccessToken(config, request as typeof fetch, () => now), 'token-2');
});

test('uses the legacy static token only when client credentials are absent', async () => {
  assert.equal(await getShopifyAdminAccessToken({ domain: config.domain, staticToken: 'legacy-token' }), 'legacy-token');
  await assert.rejects(
    getShopifyAdminAccessToken({ domain: config.domain, clientId: 'only-id', staticToken: 'legacy-token' }),
    ShopifyAdminAuthError,
  );
});

test('returns safe errors for rejected or incomplete token responses', async () => {
  await assert.rejects(
    getShopifyAdminAccessToken(config, async () => new Response('{}', { status: 401 })),
    /Client ID 或 Client Secret/,
  );
  await assert.rejects(
    getShopifyAdminAccessToken(config, async () => Response.json({ access_token: '', expires_in: 0 })),
    /回傳格式不完整/,
  );
});
