import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withCacheDeadline } from '../runtime-cache';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('a cache operation that never settles is bounded instead of holding a saved action open', async () => {
  const startedAt = Date.now();
  await assert.rejects(withCacheDeadline(() => new Promise<never>(() => {}), 10), /RUNTIME_CACHE_TIMEOUT/);
  assert.ok(Date.now() - startedAt < 500, 'the stalled cache must release its caller');
});

test('cache deadline preserves fast reads and rejects failed operations', async () => {
  assert.equal(await withCacheDeadline(async () => 42), 42);
  await assert.rejects(withCacheDeadline(async () => { throw new Error('CACHE_DOWN'); }), /CACHE_DOWN/);
});

test('a cache rejection after the deadline remains handled', async () => {
  let rejectLate!: (error: Error) => void;
  const remote = new Promise<never>((_, reject) => { rejectLate = reject; });
  await assert.rejects(withCacheDeadline(() => remote, 10), /RUNTIME_CACHE_TIMEOUT/);
  rejectLate(new Error('LATE_CACHE_FAILURE'));
  await new Promise(resolve => setImmediate(resolve));
});

test('real cache read, write and invalidation callers all recover from a stalled provider', async () => {
  const calls: string[] = [];
  const stalled = (name: string) => { calls.push(name); return new Promise<never>(() => {}); };
  const output = ts.transpileModule(readFileSync('lib/runtime-cache.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded: Record<string, Function> = {};
  const injectedRequire = (name: string) => {
    if (name === 'next/cache') return { revalidateTag() {} };
    if (name === '@vercel/functions') return { getCache: () => ({
      get: () => stalled('get'), set: () => stalled('set'), expireTag: () => stalled('expireTag'),
    }) };
    throw new Error(`Unexpected cache dependency: ${name}`);
  };
  new Function('require', 'exports', output)(injectedRequire, loaded);
  let loads = 0;
  const startedAt = Date.now();
  const value = await loaded.withRuntimeCache('fixture', { ttlSeconds: 30, tags: ['fixture'] }, async () => {
    loads += 1;
    return { fromDatabase: true };
  });
  assert.deepEqual(value, { fromDatabase: true });
  assert.equal(loads, 1);
  await loaded.bustCacheTags('fixture');
  assert.deepEqual(calls, ['get', 'set', 'expireTag']);
  assert.ok(Date.now() - startedAt < 6000, 'saved actions and rendering cannot await the provider forever');
});
