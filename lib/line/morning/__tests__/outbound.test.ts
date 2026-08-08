import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyIpForSsrf,
  fetchAllowlistedUrl,
  validateOutboundUrl,
} from '../news/outbound';

describe('morning outbound SSRF', () => {
  it('阻擋 private / link-local / metadata IPv4', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '192.168.1.1',
      '172.16.0.1',
      '169.254.169.254',
      '0.0.0.0',
      '224.0.0.1',
    ]) {
      assert.equal(classifyIpForSsrf(ip), 'blocked', ip);
    }
    assert.equal(classifyIpForSsrf('8.8.8.8'), 'ok');
  });

  it('阻擋 IPv6 local', () => {
    assert.equal(classifyIpForSsrf('::1'), 'blocked');
    assert.equal(classifyIpForSsrf('fe80::1'), 'blocked');
    assert.equal(classifyIpForSsrf('fd00::1'), 'blocked');
  });

  it('拒絕 http／credentials／未授權 host', async () => {
    assert.equal((await validateOutboundUrl('http://moa.gov.tw/x')).ok, false);
    assert.equal(
      (await validateOutboundUrl('https://user:pass@moa.gov.tw/open_data.php')).ok,
      false,
    );
    assert.equal((await validateOutboundUrl('https://evil.example/rss.xml')).ok, false);
  });

  it('enabled=false 來源禁止 live fetch', async () => {
    const r = await fetchAllowlistedUrl(
      'https://www.moa.gov.tw/open_data.php?format=rss&func=news_hot',
      { requireEnabledSource: true },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'source_disabled');
  });

  it('redirect 超過上限失敗；每次需重驗證', async () => {
    let hops = 0;
    const fetchImpl = (async () => {
      hops += 1;
      return new Response(null, {
        status: 302,
        headers: { location: 'https://www.moa.gov.tw/open_data.php?format=rss&func=news_agri' },
      });
    }) as unknown as typeof fetch;

    const r = await fetchAllowlistedUrl(
      'https://www.moa.gov.tw/open_data.php?format=rss&func=news_hot',
      { requireEnabledSource: false, maxRedirects: 2, fetchImpl },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'redirect_exceeded');
    assert.ok(hops >= 3);
  });

  it('bad MIME／oversize／timeout', async () => {
    const badMime = (async () =>
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as unknown as typeof fetch;
    const r1 = await fetchAllowlistedUrl(
      'https://www.moa.gov.tw/open_data.php?format=rss&func=news_hot',
      { requireEnabledSource: false, fetchImpl: badMime },
    );
    assert.equal(r1.ok, false);
    if (!r1.ok) assert.equal(r1.reason, 'bad_mime');

    const big = Buffer.alloc(1 * 1024 * 1024 + 10, 1);
    const oversize = (async () =>
      new Response(big, {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      })) as unknown as typeof fetch;
    const r2 = await fetchAllowlistedUrl(
      'https://www.moa.gov.tw/open_data.php?format=rss&func=news_hot',
      { requireEnabledSource: false, fetchImpl: oversize },
    );
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.reason, 'oversize');
  });
});
