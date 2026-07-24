import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CDN_IMMUTABLE_ASSET,
  CDN_PUBLIC_HTML,
  CDN_PUBLIC_HTML_LONG,
} from '@/lib/cdn-headers';

describe('cdn-headers', () => {
  it('public HTML allows CDN s-maxage and SWR', () => {
    assert.match(CDN_PUBLIC_HTML, /public/);
    assert.match(CDN_PUBLIC_HTML, /s-maxage=/);
    assert.match(CDN_PUBLIC_HTML, /stale-while-revalidate=/);
  });

  it('login shell uses longer CDN TTL', () => {
    assert.match(CDN_PUBLIC_HTML_LONG, /s-maxage=3600/);
  });

  it('static assets are immutable', () => {
    assert.match(CDN_IMMUTABLE_ASSET, /immutable/);
    assert.match(CDN_IMMUTABLE_ASSET, /max-age=31536000/);
  });
});
