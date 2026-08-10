import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contentTypeToDeliveryKind,
  decideMorningContent,
  resolveAlternatePrimaryIntent,
  type MorningAvailability,
} from '../domain/decision';

const ALL: MorningAvailability = {
  hasSafeNews: true,
  hasAnimalFact: true,
  hasHumor: true,
};
const NONE: MorningAvailability = {
  hasSafeNews: false,
  hasAnimalFact: false,
  hasHumor: false,
};

describe('Phase 4B-A／4B-C decision engine', () => {
  it('HUMOR_ONLY 繞過 NEWS／FACT', () => {
    const d = decideMorningContent({
      contentMode: 'jokes',
      availability: ALL,
      taipeiDate: '2026-08-08',
    });
    assert.equal(d.outcome, 'DELIVER');
    if (d.outcome === 'DELIVER') assert.equal(d.contentType, 'HUMOR');
  });

  it('NEWS_ONLY 無安全新聞 → no_safe_news（不退 HUMOR／FACT）', () => {
    const d = decideMorningContent({
      contentMode: 'news',
      availability: { ...ALL, hasSafeNews: false },
      taipeiDate: '2026-08-08',
    });
    assert.equal(d.outcome, 'SKIP');
    if (d.outcome === 'SKIP') assert.equal(d.reason, 'no_safe_news');
  });

  it('ALTERNATE 4B-C：last SUCCESS 推進；NEWS 缺不暗換笑話', () => {
    assert.equal(resolveAlternatePrimaryIntent({}), 'HUMOR');
    assert.equal(
      resolveAlternatePrimaryIntent({ lastSuccessContentType: 'HUMOR' }),
      'NEWS',
    );
    assert.equal(
      resolveAlternatePrimaryIntent({ lastSuccessContentType: 'NEWS' }),
      'HUMOR',
    );

    const first = decideMorningContent({
      contentMode: 'alternate',
      availability: ALL,
      taipeiDate: '2026-08-07',
      lastSuccessContentType: null,
    });
    assert.equal(first.outcome, 'DELIVER');
    if (first.outcome === 'DELIVER') assert.equal(first.contentType, 'HUMOR');

    const newsTurnMissing = decideMorningContent({
      contentMode: 'alternate',
      availability: { hasSafeNews: false, hasAnimalFact: true, hasHumor: true },
      taipeiDate: '2026-08-07',
      lastSuccessContentType: 'HUMOR',
    });
    assert.equal(newsTurnMissing.outcome, 'SKIP');
    if (newsTurnMissing.outcome === 'SKIP') {
      assert.equal(newsTurnMissing.reason, 'no_safe_news');
    }
  });

  it('OFF／UNSET 不活躍', () => {
    for (const mode of ['off', 'unset', 'OFF', 'UNSET']) {
      const d = decideMorningContent({
        contentMode: mode,
        availability: ALL,
        taipeiDate: '2026-08-08',
      });
      assert.equal(d.outcome, 'SKIP');
      if (d.outcome === 'SKIP') assert.equal(d.reason, 'not_opted_in');
    }
  });

  it('NEWS_FIRST_FACT_FALLBACK：無新聞走 FACT；不退 HUMOR', () => {
    const d = decideMorningContent({
      contentMode: 'news_first_fact_fallback',
      availability: { hasSafeNews: false, hasAnimalFact: true, hasHumor: true },
      taipeiDate: '2026-08-08',
    });
    assert.equal(d.outcome, 'DELIVER');
    if (d.outcome === 'DELIVER') assert.equal(d.contentType, 'ANIMAL_FACT');

    const none = decideMorningContent({
      contentMode: 'NEWS_FIRST_FACT_FALLBACK',
      availability: { hasSafeNews: false, hasAnimalFact: false, hasHumor: true },
      taipeiDate: '2026-08-08',
    });
    assert.equal(none.outcome, 'SKIP');
    if (none.outcome === 'SKIP') assert.equal(none.reason, 'no_content');
  });

  it('NEWS_FIRST_FACT_OR_HUMOR_FALLBACK：NEWS→FACT→HUMOR', () => {
    const toHumor = decideMorningContent({
      contentMode: 'news_first_fact_or_humor_fallback',
      availability: { hasSafeNews: false, hasAnimalFact: false, hasHumor: true },
      taipeiDate: '2026-08-08',
    });
    assert.equal(toHumor.outcome, 'DELIVER');
    if (toHumor.outcome === 'DELIVER') assert.equal(toHumor.contentType, 'HUMOR');

    const empty = decideMorningContent({
      contentMode: 'news_first_fact_or_humor_fallback',
      availability: NONE,
      taipeiDate: '2026-08-08',
    });
    assert.equal(empty.outcome, 'SKIP');
  });

  it('delivery kind 相容映射', () => {
    assert.equal(contentTypeToDeliveryKind('HUMOR'), 'joke');
    assert.equal(contentTypeToDeliveryKind('NEWS'), 'news');
    assert.equal(contentTypeToDeliveryKind('ANIMAL_FACT'), 'animal_fact');
  });
});
