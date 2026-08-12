import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('syncLineProfileForUser', () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token-not-real';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    } else {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = originalToken;
    }
  });

  it('fails gracefully when LINE profile fetch fails (does not throw)', async () => {
    globalThis.fetch = mock.fn(async () =>
      new Response('forbidden', { status: 403 }),
    ) as unknown as typeof fetch;

    // prisma import may fail without DB; sync catches all errors
    const { syncLineProfileForUser } = await import('../sync-profile');
    await assert.doesNotReject(async () => {
      const result = await syncLineProfileForUser(
        'Ueb6e0123456789abcdef0123456789f9fd',
        { force: true },
      );
      // fetch_failed or sync_error (if prisma unavailable) both ok
      assert.equal(result.ok, false);
      assert.ok(
        result.reason === 'fetch_failed' || result.reason === 'sync_error',
      );
    });
  });

  it('returns empty_user without calling network', async () => {
    let called = false;
    globalThis.fetch = mock.fn(async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const { syncLineProfileForUser } = await import('../sync-profile');
    const result = await syncLineProfileForUser('   ');
    assert.deepEqual(result, { ok: false, reason: 'empty_user' });
    assert.equal(called, false);
  });
});
