import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyNewsSafety, newsFingerprint } from '../news/safety';
import { pickAutoApprovedNews, processCandidates } from '../news/provider';
import { MOCK_NEWS_FIXTURES } from '../news/mock-feed';

describe('morning news safety', () => {
  it('白名單輕鬆新聞可 AUTO_APPROVED；疾病／偏方 BLOCKED', () => {
    const processed = processCandidates(MOCK_NEWS_FIXTURES);
    const ok = processed.filter((p) => p.status === 'AUTO_APPROVED');
    assert.ok(ok.length >= 1);
    assert.ok(ok.some((p) => p.region === 'tw'));

    const blockedDisease = classifyNewsSafety(MOCK_NEWS_FIXTURES[2]!);
    assert.equal(blockedDisease.status, 'BLOCKED');

    const blockedUnlisted = classifyNewsSafety(MOCK_NEWS_FIXTURES[3]!);
    assert.equal(blockedUnlisted.status, 'BLOCKED');
    assert.ok(blockedUnlisted.reasons.includes('source_not_whitelisted'));
  });

  it('DRAFT/危險狀態不可進晨報挑選', () => {
    const processed = processCandidates(MOCK_NEWS_FIXTURES);
    const picked = pickAutoApprovedNews(processed);
    assert.ok(picked);
    assert.equal(picked!.status, 'AUTO_APPROVED');
    assert.ok(!processed.filter((p) => p.status !== 'AUTO_APPROVED').includes(picked!));
  });

  it('fingerprint 去重穩定', () => {
    const d = new Date('2026-08-05T02:00:00.000Z');
    const a = newsFingerprint(
      'https://zoo.taipei.gov.tw/news/x?utm_source=test#frag',
      d,
    );
    const b = newsFingerprint('https://zoo.taipei.gov.tw/news/x', d);
    assert.equal(a, b);
  });
});
