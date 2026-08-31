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
    if (name === '@/lib/logistics/ecpay-directory') return { fetchDirectory: async (config: { environment: string }) => {
      providerCalls++; assert.equal(config.environment, 'stage');
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
