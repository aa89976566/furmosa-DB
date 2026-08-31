import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createSearchService } from './search-service';

// Execute the real route source with isolated auth and provider boundaries.
// No database, credentials, network, or live session is used.
function harness(user: unknown, env: Record<string, string>) {
  let providerCalls = 0;
  const source = readFileSync('app/api/logistics/pickup-stores/route.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: Record<string, any> = {};
  const context = createContext({ exports: exported, Date, process: { env }, fetch: () => { throw new Error('network forbidden'); }, require: (name: string) => {
    if (name === 'next/server') return { NextResponse: { json: (body: unknown, init: ResponseInit) => Response.json(body, init) } };
    if (name === '@/lib/auth') return { getCurrentUser: async () => user };
    if (name === '@/lib/logistics/search-service') return { createSearchService };
    if (name === '@/lib/logistics/ecpay-directory') return { fetchDirectory: async (config: { environment: string; merchantId: string; hashKey: string; hashIV: string }) => {
      providerCalls++; assert.equal(config.environment, env.PICKUP_DIRECTORY_SOURCE === 'live-readonly' ? 'production' : 'stage');
      const credentials = config;
      const prefix = env.PICKUP_DIRECTORY_SOURCE === 'live-readonly' ? 'ECPAY_LOGISTICS_LIVE_' : 'ECPAY_LOGISTICS_TEST_';
      assert.equal(credentials.merchantId, env[prefix + 'MERCHANT_ID'] ?? '');
      assert.equal(credentials.hashKey, env[prefix + 'HASH_KEY'] ?? '');
      assert.equal(credentials.hashIV, env[prefix + 'HASH_IV'] ?? '');
      return { fetchedAt: Date.now(), stores: [{ id: '001', name: '示範店', address: '示範地址', serviceType: 'UNIMART' }] };
    } };
    throw new Error('Unexpected dependency: ' + name);
  } });
  new Script(compiled).runInContext(context);
  return { get: (query = 'q=示範') => exported.GET({ nextUrl: new URL('https://preview.test/api/logistics/pickup-stores?' + query) }) as Promise<Response>, calls: () => providerCalls };
}
test('route denies unauthenticated HQ access without provider calls', async () => {
  const h = harness(null, { VERCEL_ENV: 'preview', PICKUP_SEARCH_PREVIEW_ENABLED: 'true' });
  const response = await h.get(); assert.equal(response.status, 401); assert.equal(h.calls(), 0);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('selection route resolves canonical data and ignores submitted names and addresses', async () => {
  const env = { VERCEL_ENV: 'preview', PICKUP_SEARCH_PREVIEW_ENABLED: 'true' };
  const h = harness({ userId: 'fixture' }, env);
  const response = await h.get('storeId=001&temperature=ambient&name=fake&address=fake');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).store, { id: '001', name: '示範店', address: '示範地址', serviceType: 'UNIMART' });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await h.get('storeId=missing')).status, 409);
  assert.equal((await h.get('storeId=')).status, 400);
  assert.equal((await h.get('storeId=001&temperature=frozen')).status, 503);
  const denied = harness(null, env);
  assert.equal((await denied.get('storeId=001')).status, 401);
  assert.equal(denied.calls(), 0);
  const production = harness({ userId: 'fixture' }, { ...env, VERCEL_ENV: 'production' });
  assert.equal((await production.get('storeId=001')).status, 503);
  assert.equal(production.calls(), 0);
});
test('live read-only uses dedicated live credentials, never test credentials', async () => {
  const h = harness({ userId: 'fixture' }, {
    VERCEL_ENV: 'preview', PICKUP_SEARCH_PREVIEW_ENABLED: 'true', PICKUP_DIRECTORY_SOURCE: 'live-readonly',
    ECPAY_LOGISTICS_LIVE_MERCHANT_ID: '1111111', ECPAY_LOGISTICS_LIVE_HASH_KEY: 'fixture-live-key', ECPAY_LOGISTICS_LIVE_HASH_IV: 'fixture-live-iv',
    ECPAY_LOGISTICS_TEST_MERCHANT_ID: '2222222', ECPAY_LOGISTICS_TEST_HASH_KEY: 'fixture-test-key', ECPAY_LOGISTICS_TEST_HASH_IV: 'fixture-test-iv',
  });
  assert.equal((await h.get()).status, 200);
  assert.equal(h.calls(), 1);
  assert.equal((await h.get('q=示範&temperature=frozen')).status, 503);
});
test('production deployment and invalid source cannot enable live queries', async () => {
  for (const env of [
    { VERCEL_ENV: 'production', PICKUP_DIRECTORY_SOURCE: 'live-readonly' },
    { VERCEL_ENV: 'preview', PICKUP_DIRECTORY_SOURCE: 'production' },
  ]) {
    const h = harness({ userId: 'fixture' }, { ...env, PICKUP_SEARCH_PREVIEW_ENABLED: 'true' });
    assert.equal((await h.get()).status, 503);
    assert.equal(h.calls(), 0);
  }
});
test('production and unenabled previews cannot query provider', async () => {
  for (const env of [{ VERCEL_ENV: 'production', PICKUP_SEARCH_PREVIEW_ENABLED: 'true' }, { VERCEL_ENV: 'preview', PICKUP_SEARCH_PREVIEW_ENABLED: 'false' }]) {
    const h = harness({ userId: 'fixture' }, env); assert.equal((await h.get()).status, 503); assert.equal(h.calls(), 0);
  }
});
test('enabled preview returns search results but blocks unverified frozen service', async () => {
  const h = harness({ userId: 'fixture' }, { VERCEL_ENV: 'preview', PICKUP_SEARCH_PREVIEW_ENABLED: 'true' });
  const response = await h.get(); assert.equal(response.status, 200); assert.equal((await response.json()).stores[0].id, '001');
  assert.equal((await h.get('q=示範&temperature=frozen')).status, 503); assert.equal(h.calls(), 1);
});
