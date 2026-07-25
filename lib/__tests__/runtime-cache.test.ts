import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from '@prisma/client/runtime/library';
import { withRuntimeCache } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

describe('withRuntimeCache', () => {
  it('caches loader result in-process when Runtime Cache unavailable', async () => {
    let calls = 0;
    const key = `test-runtime-cache-${Date.now()}`;

    const a = await withRuntimeCache(
      key,
      { ttlSeconds: 30, tags: [CACHE_TAGS.dashboard] },
      async () => {
        calls += 1;
        return { n: 42 };
      },
    );
    const b = await withRuntimeCache(
      key,
      { ttlSeconds: 30, tags: [CACHE_TAGS.dashboard] },
      async () => {
        calls += 1;
        return { n: 99 };
      },
    );

    assert.equal(a.n, 42);
    assert.equal(b.n, 42);
    assert.equal(calls, 1);
  });

  it('returns JSON-safe values when loader yields Decimal/Date', async () => {
    const key = `test-runtime-cache-decimal-${Date.now()}`;
    const result = await withRuntimeCache(
      key,
      { ttlSeconds: 30, tags: [CACHE_TAGS.dashboard] },
      async () => ({
        total: new Decimal('88.2'),
        at: new Date('2026-07-01T12:00:00.000Z'),
      }),
    );

    assert.equal(result.total, 88.2);
    assert.equal(result.at, '2026-07-01T12:00:00.000Z');
  });
});
