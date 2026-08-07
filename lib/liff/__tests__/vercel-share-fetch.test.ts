import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSameOriginLiffApiPath,
  liffPreviewFetch,
  readVercelShareFromPageUrl,
  resolveLiffPreviewFetchUrl,
  withExistingVercelShare,
} from '@/lib/liff/vercel-share-fetch';

describe('isSameOriginLiffApiPath', () => {
  it('accepts refill and line liff API paths', () => {
    assert.equal(isSameOriginLiffApiPath('/api/refill/eligibility'), true);
    assert.equal(isSameOriginLiffApiPath('/api/line/liff/register'), true);
    assert.equal(isSameOriginLiffApiPath('/api/line/liff/me'), true);
  });

  it('rejects other and absolute URLs', () => {
    assert.equal(isSameOriginLiffApiPath('/api/health'), false);
    assert.equal(isSameOriginLiffApiPath('/liff/register'), false);
    assert.equal(
      isSameOriginLiffApiPath('https://example.com/api/line/liff/register'),
      false,
    );
  });
});

describe('resolveLiffPreviewFetchUrl + withExistingVercelShare', () => {
  const page =
    'https://preview.example/liff/register?return=%2Fliff%2Frefill&_vercel_share=share-token';

  it('forwards share onto /api/line/liff/register', () => {
    assert.equal(
      resolveLiffPreviewFetchUrl('/api/line/liff/register', page),
      '/api/line/liff/register?_vercel_share=share-token',
    );
  });

  it('preserves share on register↔refill navigation targets', () => {
    assert.equal(
      withExistingVercelShare('/liff/register?return=%2Fliff%2Frefill', page),
      '/liff/register?return=%2Fliff%2Frefill&_vercel_share=share-token',
    );
    assert.equal(
      withExistingVercelShare('/liff/refill?storeId=x', page),
      '/liff/refill?storeId=x&_vercel_share=share-token',
    );
  });

  it('does not invent share', () => {
    assert.equal(
      withExistingVercelShare(
        '/liff/register?return=%2Fliff%2Frefill',
        'https://preview.example/liff/refill',
      ),
      '/liff/register?return=%2Fliff%2Frefill',
    );
    assert.equal(readVercelShareFromPageUrl('https://preview.example/liff/refill'), null);
  });
});

describe('liffPreviewFetch', () => {
  it('forwards share + credentials for line liff API', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      await liffPreviewFetch(
        '/api/line/liff/register',
        { method: 'POST', body: '{}' },
        'https://preview.example/liff/register?_vercel_share=share-token',
      );
      assert.equal(calls[0].url, '/api/line/liff/register?_vercel_share=share-token');
      assert.equal(calls[0].init?.credentials, 'include');
    } finally {
      globalThis.fetch = original;
    }
  });
});
