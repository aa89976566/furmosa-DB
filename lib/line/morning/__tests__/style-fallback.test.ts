import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LINE_REGISTER_INTRO } from '@/lib/line/line-copy';
import { MORNING_SKIP_REASONS } from '../constants';
import {
  assertNoInventedFacts,
  lintMorningStyle,
  renderNewsInStyle,
  SUSHI_INTRO_CANONICAL,
} from '../style';
import { pickAutoApprovedNews, processCandidates } from '../news/provider';
import { MOCK_NEWS_FIXTURES } from '../news/mock-feed';

describe('morning style module', () => {
  it('初次見面核心與單一汪', () => {
    const lint = lintMorningStyle(LINE_REGISTER_INTRO, { kind: 'intro' });
    assert.equal(lint.ok, true);
    assert.match(SUSHI_INTRO_CANONICAL, /壽司匠/);
  });

  it('禁語與多 Bark 失敗', () => {
    assert.equal(lintMorningStyle('親愛的小編汪汪汪必看', { kind: 'joke' }).ok, false);
  });

  it('新聞模板含來源與原文連結；不發明數字', () => {
    const src = '示範園區替水獺更新漂浮玩具後，觀察到探索時間變長。';
    const { text, lint } = renderNewsInStyle({
      factSummary: src,
      observation: '玩具一進水，認真程度瞬間像開會。',
      sourceName: 'Fixture Placeholder',
      publishedAt: new Date('2026-08-08T00:00:00Z'),
      canonicalUrl: 'https://fixtures.morning.local/placeholder/a',
    });
    assert.match(text, /來源：/);
    assert.match(text, /fixtures\.morning\.local/);
    assert.equal(assertNoInventedFacts(text, src).ok, true);
    assert.equal(assertNoInventedFacts('來了 99 隻', src).ok, false);
    void lint;
  });
});

describe('news vs alternate fallback policy', () => {
  it('fixture 處理後疾病／偏方不可 AUTO_APPROVED', () => {
    const processed = processCandidates(MOCK_NEWS_FIXTURES, new Date());
    const picked = pickAutoApprovedNews(processed);
    if (picked) {
      assert.equal(picked.title.includes('[FIXTURE]'), true);
      assert.equal(picked.status, 'AUTO_APPROVED');
      assert.equal(picked.title.includes('疾病'), false);
      assert.equal(picked.title.includes('偏方'), false);
    }
    assert.ok(processed.every((p) => p.title.includes('[FIXTURE]') || p.contentHash));
  });

  it('skip reason 常數含 no_safe_news', () => {
    assert.equal(MORNING_SKIP_REASONS.NO_SAFE_NEWS, 'no_safe_news');
  });
});
