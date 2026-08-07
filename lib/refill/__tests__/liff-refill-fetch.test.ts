import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSameOriginRefillApiPath,
  liffRefillFetch,
  readVercelShareFromPageUrl,
  resolveLiffRefillFetchUrl,
} from '@/lib/refill/liff-refill-fetch';

describe('isSameOriginRefillApiPath', () => {
  it('accepts relative /api/refill paths', () => {
    assert.equal(isSameOriginRefillApiPath('/api/refill/eligibility'), true);
    assert.equal(isSameOriginRefillApiPath('/api/refill/orders/abc'), true);
    assert.equal(isSameOriginRefillApiPath('/api/refill/orders/abc/payment'), true);
    assert.equal(isSameOriginRefillApiPath('/api/refill'), true);
    assert.equal(isSameOriginRefillApiPath('/api/refill/eligibility?x=1'), true);
  });

  it('also accepts LINE LIFF API paths (shared Preview helper)', () => {
    assert.equal(isSameOriginRefillApiPath('/api/line/liff/me'), true);
    assert.equal(isSameOriginRefillApiPath('/api/line/liff/register'), true);
  });

  it('rejects non-LIFF and absolute / protocol-relative URLs', () => {
    assert.equal(isSameOriginRefillApiPath('/api/health'), false);
    assert.equal(isSameOriginRefillApiPath('/liff/refill'), false);
    assert.equal(
      isSameOriginRefillApiPath('https://example.com/api/refill/eligibility'),
      false,
    );
    assert.equal(isSameOriginRefillApiPath('//evil.test/api/refill/eligibility'), false);
    assert.equal(isSameOriginRefillApiPath(''), false);
  });
});

describe('readVercelShareFromPageUrl', () => {
  it('reads non-empty _vercel_share from href or search', () => {
    assert.equal(
      readVercelShareFromPageUrl(
        'https://preview.example/liff/refill?_vercel_share=abc123&storeId=1',
      ),
      'abc123',
    );
    assert.equal(readVercelShareFromPageUrl('?_vercel_share=tok'), 'tok');
    assert.equal(readVercelShareFromPageUrl('/liff/refill?_vercel_share=tok'), 'tok');
  });

  it('returns null when missing or empty', () => {
    assert.equal(readVercelShareFromPageUrl('https://preview.example/liff/refill'), null);
    assert.equal(readVercelShareFromPageUrl('?storeId=1'), null);
    assert.equal(readVercelShareFromPageUrl('?_vercel_share='), null);
    assert.equal(readVercelShareFromPageUrl('?_vercel_share=%20'), null);
    assert.equal(readVercelShareFromPageUrl(''), null);
  });
});

describe('resolveLiffRefillFetchUrl', () => {
  const pageWithShare =
    'https://preview.example/liff/refill?_vercel_share=share-token&storeId=x';
  const pageWithout = 'https://preview.example/liff/refill?storeId=x';

  it('forwards share onto same-origin refill API when page has it', () => {
    assert.equal(
      resolveLiffRefillFetchUrl('/api/refill/eligibility', pageWithShare),
      '/api/refill/eligibility?_vercel_share=share-token',
    );
    assert.equal(
      resolveLiffRefillFetchUrl('/api/refill/orders/oid1/payment', pageWithShare),
      '/api/refill/orders/oid1/payment?_vercel_share=share-token',
    );
  });

  it('does not forward when page lacks share', () => {
    assert.equal(
      resolveLiffRefillFetchUrl('/api/refill/eligibility', pageWithout),
      '/api/refill/eligibility',
    );
  });

  it('does not forward onto non-refill or absolute URLs', () => {
    assert.equal(
      resolveLiffRefillFetchUrl('/api/health', pageWithShare),
      '/api/health',
    );
    assert.equal(
      resolveLiffRefillFetchUrl(
        'https://other.example/api/refill/eligibility',
        pageWithShare,
      ),
      'https://other.example/api/refill/eligibility',
    );
  });

  it('preserves existing request query and does not duplicate share', () => {
    assert.equal(
      resolveLiffRefillFetchUrl('/api/refill/eligibility?foo=1', pageWithShare),
      '/api/refill/eligibility?foo=1&_vercel_share=share-token',
    );
    assert.equal(
      resolveLiffRefillFetchUrl(
        '/api/refill/eligibility?_vercel_share=already',
        pageWithShare,
      ),
      '/api/refill/eligibility?_vercel_share=already',
    );
  });
});

describe('liffRefillFetch', () => {
  it('uses credentials:include and forwarded URL for refill API when share present', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      await liffRefillFetch(
        '/api/refill/eligibility',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
        'https://preview.example/liff/refill?_vercel_share=share-token',
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/api/refill/eligibility?_vercel_share=share-token');
      assert.equal(calls[0].init?.credentials, 'include');
      assert.equal(calls[0].init?.method, 'POST');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('leaves non-refill fetch init unchanged (no share, no credentials override)', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const init: RequestInit = { method: 'GET' };
      await liffRefillFetch(
        '/api/health',
        init,
        'https://preview.example/liff/refill?_vercel_share=share-token',
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/api/health');
      assert.equal(calls[0].init, init);
      assert.equal(calls[0].init?.credentials, undefined);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('behaves as plain fetch for refill API when page has no share', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const original = globalThis.fetch;
    const init: RequestInit = { method: 'POST' };
    globalThis.fetch = (async (input: RequestInfo | URL, nextInit?: RequestInit) => {
      calls.push({ url: String(input), init: nextInit });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      await liffRefillFetch(
        '/api/refill/eligibility',
        init,
        'https://preview.example/liff/refill',
      );
      assert.equal(calls[0].url, '/api/refill/eligibility');
      assert.equal(calls[0].init, init);
      assert.equal(calls[0].init?.credentials, undefined);
    } finally {
      globalThis.fetch = original;
    }
  });
});
