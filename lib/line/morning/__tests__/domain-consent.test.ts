import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  alternateAllowsAnimalFactFallback,
  inventsFactMixedConsent,
  isDomainActivelySubscribed,
  isSemanticallyEqualLegacyMapping,
  toDomainContentMode,
  toDomainFrequency,
  toStorageContentMode,
  toStorageFrequency,
} from '@/lib/line/morning/domain';

describe('Phase 4B-A consent mapping（零擴張）', () => {
  it('jokes → HUMOR_ONLY；news → NEWS_ONLY（語意相等）', () => {
    assert.equal(toDomainContentMode('jokes'), 'HUMOR_ONLY');
    assert.equal(toDomainContentMode('news'), 'NEWS_ONLY');
    assert.equal(isSemanticallyEqualLegacyMapping('jokes', 'HUMOR_ONLY'), true);
    assert.equal(isSemanticallyEqualLegacyMapping('news', 'NEWS_ONLY'), true);
    assert.equal(toStorageContentMode('HUMOR_ONLY'), 'jokes');
    assert.equal(toStorageContentMode('NEWS_ONLY'), 'news');
  });

  it('alternate 保留相容值；決策層不得開 ANIMAL_FACT fallback', () => {
    assert.equal(toDomainContentMode('alternate'), 'ALTERNATE');
    assert.equal(toDomainContentMode('ALTERNATE'), 'ALTERNATE');
    assert.equal(toStorageContentMode('ALTERNATE'), 'alternate');
    assert.equal(alternateAllowsAnimalFactFallback('ALTERNATE'), false);
    assert.equal(inventsFactMixedConsent('alternate'), false);
    assert.equal(inventsFactMixedConsent('jokes'), false);
    assert.equal(inventsFactMixedConsent('news'), false);
  });

  it('off／unset 為不活躍；未知值 fail-closed 為 UNSET', () => {
    assert.equal(toDomainContentMode('off'), 'OFF');
    assert.equal(toDomainContentMode('unset'), 'UNSET');
    assert.equal(toDomainContentMode('OFF'), 'OFF');
    assert.equal(toDomainContentMode(undefined), 'UNSET');
    assert.equal(toDomainContentMode('totally_unknown'), 'UNSET');
    assert.equal(
      isDomainActivelySubscribed({
        contentMode: 'off',
        frequency: 'daily',
      }),
      false,
    );
    assert.equal(
      isDomainActivelySubscribed({
        contentMode: 'unset',
        frequency: 'daily',
      }),
      false,
    );
    assert.equal(
      isDomainActivelySubscribed({
        contentMode: 'jokes',
        frequency: 'unset',
      }),
      false,
    );
  });

  it('舊 jokes／news／alternate 不會被映射成 FACT mixed modes', () => {
    for (const raw of ['jokes', 'news', 'alternate', 'off', 'unset']) {
      const mode = toDomainContentMode(raw);
      assert.notEqual(mode, 'NEWS_FIRST_FACT_FALLBACK');
      assert.notEqual(mode, 'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK');
    }
  });

  it('僅當 DB 已是 FACT mixed 值時才視為明確 re-opt-in', () => {
    assert.equal(
      toDomainContentMode('news_first_fact_fallback'),
      'NEWS_FIRST_FACT_FALLBACK',
    );
    assert.equal(
      toDomainContentMode('news_first_fact_or_humor_fallback'),
      'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
    );
    assert.equal(
      isDomainActivelySubscribed({
        contentMode: 'news_first_fact_fallback',
        frequency: 'daily',
      }),
      true,
    );
  });

  it('frequency：DB 值不變；domain weekday→WEEKDAYS', () => {
    assert.equal(toDomainFrequency('daily'), 'DAILY');
    assert.equal(toDomainFrequency('weekday'), 'WEEKDAYS');
    assert.equal(toDomainFrequency('weekly'), 'WEEKLY');
    assert.equal(toDomainFrequency('off'), 'OFF');
    assert.equal(toDomainFrequency('unset'), 'UNSET');
    assert.equal(toStorageFrequency('WEEKDAYS'), 'weekday');
    assert.equal(toStorageFrequency('DAILY'), 'daily');
  });
});
