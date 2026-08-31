import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, Script } from 'node:vm';
import ts from 'typescript';
import { createSearchService } from '../../logistics/search-service';
import { verifyAppProxyQuery } from '../app-proxy-signature';

const secret = 'fixture-only-not-a-live-key';
const shop = 'gt3bch-em.myshopify.com';
const nowSeconds = Math.floor(Date.now() / 1000);

function sign(values: Record<string, string>) {
  const params = new URLSearchParams(values);
  const message = Array.from(params.keys()).sort().map(key => `${key}=${params.getAll(key).join(',')}`).join('');
  params.set('signature', createHmac('sha256', secret).update(message).digest('hex'));
  return params.toString();
}

function harness(envOverrides: Record<string, string> = {}) {
  let providerCalls = 0;
  const env = {
    VERCEL_ENV: 'preview', SHOPIFY_APP_PROXY_PREVIEW_ENABLED: 'true', PICKUP_SEARCH_PREVIEW_ENABLED: 'true',
    SHOPIFY_APP_PROXY_SECRET: secret, SHOPIFY_APP_PROXY_SHOP: shop, ...envOverrides,
  };
  const source = readFileSync('app/api/storefront/pickup-stores/route.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: Record<string, any> = {};
  const context = createContext({ exports: exported, Date, process: { env }, fetch: () => { throw new Error('network forbidden'); }, require: (name: string) => {
    if (name === 'next/server') return { NextResponse: { json: (body: unknown, init: ResponseInit) => Response.json(body, init) } };
    if (name === '@/lib/shopify/app-proxy-signature') return { verifyAppProxyQuery };
    if (name === '@/lib/logistics/search-service') return { createSearchService };
    if (name === '@/lib/logistics/ecpay-directory') return { fetchDirectory: async () => {
      providerCalls++;
      return { fetchedAt: Date.now(), stores: [{ id: '001', name: '示範店', address: '示範地址', serviceType: 'UNIMART' }] };
    } };
    throw new Error('Unexpected dependency: ' + name);
  } });
  new Script(compiled).runInContext(context);
  return {
    get: (query: string) => {
      const url = `https://preview.test/api/storefront/pickup-stores?${query}`;
      return exported.GET({ url, nextUrl: new URL(url) }) as Promise<Response>;
    },
    calls: () => providerCalls,
  };
}

function valid(extra: Record<string, string> = {}) {
  return sign({ shop, timestamp: String(nowSeconds), path_prefix: '/apps/furmosa-pickup', logged_in_customer_id: '', q: '示範', temperature: 'ambient', ...extra });
}

test('valid Shopify proxy request can search ambient stores without HQ login', async () => {
  const h = harness();
  const response = await h.get(valid());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).stores[0].id, '001');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(h.calls(), 1);
});

test('invalid signature and production deployment fail closed before provider access', async () => {
  const invalid = harness();
  assert.equal((await invalid.get(valid() + '&storeId=001')).status, 401);
  assert.equal(invalid.calls(), 0);
  const production = harness({ VERCEL_ENV: 'production' });
  assert.equal((await production.get(valid())).status, 401);
  assert.equal(production.calls(), 0);
});

test('server resolves canonical store and frozen service remains blocked', async () => {
  const h = harness();
  const selected = await h.get(valid({ storeId: '001', q: '', name: 'fake', address: 'fake' }));
  assert.equal(selected.status, 200);
  assert.deepEqual((await selected.json()).store, { id: '001', name: '示範店', address: '示範地址', serviceType: 'UNIMART' });
  assert.equal((await h.get(valid({ temperature: 'frozen' }))).status, 503);
});
