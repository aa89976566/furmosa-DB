import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseLineProfileResponse } from '../profile';

describe('parseLineProfileResponse', () => {
  it('parses displayName and pictureUrl', () => {
    const parsed = parseLineProfileResponse({
      displayName: '  匠寵粉  ',
      pictureUrl: ' https://profile.line-scdn.net/example ',
      userId: 'Ushould-not-be-required',
    });
    assert.deepEqual(parsed, {
      displayName: '匠寵粉',
      pictureUrl: 'https://profile.line-scdn.net/example',
    });
  });

  it('allows missing pictureUrl', () => {
    assert.deepEqual(parseLineProfileResponse({ displayName: 'OnlyName' }), {
      displayName: 'OnlyName',
      pictureUrl: null,
    });
  });

  it('returns nullish fields for empty / invalid payloads', () => {
    assert.equal(parseLineProfileResponse(null), null);
    assert.deepEqual(parseLineProfileResponse({}), {
      displayName: null,
      pictureUrl: null,
    });
    assert.deepEqual(parseLineProfileResponse({ displayName: '  ' }), {
      displayName: null,
      pictureUrl: null,
    });
  });
});

describe('fetchLineUserProfile failure behavior', () => {
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

  it('returns null on non-OK LINE response (blocked / not friend)', async () => {
    globalThis.fetch = mock.fn(async () =>
      new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }),
    ) as unknown as typeof fetch;

    const { fetchLineUserProfile } = await import('../profile');
    const result = await fetchLineUserProfile('Ueb6e0123456789abcdef0123456789f9fd');
    assert.equal(result, null);
  });

  it('returns null when fetch throws; does not throw to caller', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const { fetchLineUserProfile } = await import('../profile');
    await assert.doesNotReject(async () => {
      const result = await fetchLineUserProfile('Ueb6e0123456789abcdef0123456789f9fd');
      assert.equal(result, null);
    });
  });

  it('returns null when channel token missing', async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    globalThis.fetch = mock.fn(async () => {
      throw new Error('fetch should not be called');
    }) as unknown as typeof fetch;

    const { fetchLineUserProfile } = await import('../profile');
    const result = await fetchLineUserProfile('Ueb6e0123456789abcdef0123456789f9fd');
    assert.equal(result, null);
  });

  it('parses successful profile without exposing token via return value', async () => {
    globalThis.fetch = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      assert.equal(auth, 'Bearer test-token-not-real');
      return new Response(
        JSON.stringify({
          displayName: '測試用戶',
          pictureUrl: 'https://profile.line-scdn.net/p/test',
          userId: 'Ueb6e0123456789abcdef0123456789f9fd',
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const { fetchLineUserProfile } = await import('../profile');
    const result = await fetchLineUserProfile('Ueb6e0123456789abcdef0123456789f9fd');
    assert.deepEqual(result, {
      displayName: '測試用戶',
      pictureUrl: 'https://profile.line-scdn.net/p/test',
    });
    assert.ok(!JSON.stringify(result).includes('test-token-not-real'));
  });
});
