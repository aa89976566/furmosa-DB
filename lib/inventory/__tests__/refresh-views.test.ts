import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const internal = Module as typeof Module & { _load: (...args: any[]) => any };
const originalLoad = internal._load.bind(Module);
const visited: string[] = [];
const tags: string[] = [];
let failPaths = false;
let failTags = false;
internal._load = (request, ...rest) => {
  if (request === 'next/cache') return { revalidatePath: (path: string) => {
    visited.push(path);
    if (failPaths && path === '/inventory') throw new Error('display cache offline');
  } };
  if (request === '@/lib/runtime-cache') return { bustCacheTags: async (...values: string[]) => {
    tags.push(...values);
    if (failTags) throw new Error('runtime cache offline');
  } };
  return originalLoad(request, ...rest);
};
const { refreshInventoryViews } = require('../refresh-views');
internal._load = originalLoad;

test('committed inventory updates refresh linked views; display failures never turn a committed receipt into a retryable stock failure', async () => {
  await refreshInventoryViews(['p1', 'p1']);
  for (const path of ['/inventory', '/inventory/purchases', '/inventory/transactions', '/products', '/products/p1', '/dashboard']) {
    assert.ok(visited.includes(path), path);
  }
  assert.equal(visited.filter(path => path === '/products/p1').length, 1);
  assert.deepEqual(tags, ['dashboard']);
  visited.length = 0;
  tags.length = 0;
  failPaths = true;
  failTags = true;
  const originalError = console.error;
  const errors: string[] = [];
  console.error = (message: string) => errors.push(message);
  try {
    await assert.doesNotReject(refreshInventoryViews(['p2']));
    assert.ok(visited.includes('/products/p2'), 'later views still refresh after a path fails');
    assert.deepEqual(tags, ['dashboard']);
    assert.deepEqual(errors, ['[inventory] VIEW_REFRESH_FAILED_AFTER_COMMIT']);
  } finally { console.error = originalError; }
});
