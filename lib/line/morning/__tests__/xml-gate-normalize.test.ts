import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gateNormalizedNews } from '../news/gate';
import {
  computeContentHash,
  normalizeNewsCandidate,
  parsePublishedAtStrict,
  sha256Hex,
} from '../news/normalize';
import { parseRssOrAtomSafe, stripHtml } from '../news/xml-safe';
import { listEnabledLiveSources } from '../news/registry';

describe('xml-safe parser', () => {
  it('拒絕 DOCTYPE／ENTITY', () => {
    const r = parseRssOrAtomSafe(
      `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel></channel></rss>`,
    );
    assert.equal(r.ok, false);
  });

  it('解析 RSS item 並清 HTML', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Hello &lt;b&gt;World&lt;/b&gt;</title>
      <link>https://fixtures.morning.local/placeholder/a</link>
      <description><![CDATA[<p>摘要測試</p>]]></description>
      <pubDate>Mon, 08 Aug 2026 00:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const r = parseRssOrAtomSafe(xml);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.items[0]?.title.includes('<'), false);
      assert.match(r.items[0]?.title ?? '', /Hello/);
      assert.equal(stripHtml('<script>x</script>hi'), 'hi');
    }
  });
});

describe('normalize + hash', () => {
  it('SHA-256 contentHash 穩定且非 MD5', () => {
    const h = sha256Hex('abc');
    assert.equal(h.length, 64);
    assert.notEqual(h, '900150983cd24fb0d6963f7d28e17f72'); // md5(abc)
    const a = computeContentHash({
      canonicalUrl: 'https://fixtures.morning.local/placeholder/a',
      originalTitle: 'T',
      publishedAt: new Date('2026-08-08T00:00:00Z'),
    });
    const b = computeContentHash({
      canonicalUrl: 'https://fixtures.morning.local/placeholder/a',
      originalTitle: 'T',
      publishedAt: new Date('2026-08-08T12:00:00Z'),
    });
    assert.equal(a, b);
  });

  it('缺日期／未來／過期 fail-closed', () => {
    const now = new Date('2026-08-08T08:00:00Z');
    assert.equal(parsePublishedAtStrict(null, now).ok, false);
    assert.equal(parsePublishedAtStrict('2026-08-09T10:00:00Z', now).ok, false);
    assert.equal(parsePublishedAtStrict('2020-01-01T00:00:00Z', now).ok, false);
    assert.equal(parsePublishedAtStrict('2026-08-07T10:00:00Z', now).ok, true);
  });

  it('normalize fixture OK', () => {
    const r = normalizeNewsCandidate({
      sourceId: 'fixture_placeholder',
      canonicalUrl: 'https://fixtures.morning.local/placeholder/x?utm_source=1',
      originalTitle: '[FIXTURE] 標題',
      originalSummary: '摘要內容足夠長以便後續 style 檢查使用的占位文字。',
      publishedAt: new Date().toISOString(),
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.canonicalUrl.includes('utm_'), false);
      assert.equal(r.value.contentHash.length, 64);
    }
  });
});

describe('gate layers', () => {
  it('疾病硬規則 BLOCKED；classifier 不可放寬', () => {
    const n = normalizeNewsCandidate({
      sourceId: 'fixture_placeholder',
      canonicalUrl: 'https://fixtures.morning.local/placeholder/disease',
      originalTitle: '[FIXTURE] 疫情',
      originalSummary: '出現寵物疾病感染案例，衛生單位調查中。',
      publishedAt: new Date().toISOString(),
    });
    assert.equal(n.ok, true);
    if (!n.ok) return;
    const g = gateNormalizedNews(n.value);
    assert.equal(g.status, 'BLOCKED');
    assert.ok(g.riskLabels.includes('disease'));
  });

  it('live enabled 來源數為 0', () => {
    assert.equal(listEnabledLiveSources().length, 0);
  });
});
