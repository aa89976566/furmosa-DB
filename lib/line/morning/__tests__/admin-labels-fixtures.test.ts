import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isFixtureCanonicalUrl,
  labelCountryPriority,
  labelEnabled,
  labelNewsStatus,
  labelPetTag,
  labelRegion,
  labelRiskLevel,
} from '../admin-labels';
import { MORNING_JOKE_DRAFT_FIXTURES } from '../fixtures';
import { FIXTURE_NEWS_RAW, MOCK_NEWS_FIXTURES } from '../news/mock-feed';
import { processCandidates } from '../news/provider';
import { lintMorningStyle } from '../style';

describe('admin labels (台灣繁中)', () => {
  it('主要狀態與風險／地區標籤', () => {
    assert.equal(labelNewsStatus('AUTO_APPROVED'), '自動通過');
    assert.equal(labelNewsStatus('BLOCKED'), '已阻擋');
    assert.equal(labelRiskLevel('low'), '低風險');
    assert.equal(labelRiskLevel('high'), '高風險');
    assert.equal(labelRegion('tw'), '台灣');
    assert.equal(labelRegion('global'), '全球');
    assert.equal(labelCountryPriority('TW'), '台灣');
    assert.equal(labelCountryPriority('GLOBAL'), '全球');
    assert.equal(labelEnabled(false), '未啟用');
    assert.equal(labelPetTag('rabbit'), '兔');
    assert.equal(labelPetTag('bird'), '鳥');
  });

  it('辨識 fixture URL', () => {
    assert.equal(
      isFixtureCanonicalUrl('https://fixtures.morning.local/placeholder/a'),
      true,
    );
    assert.equal(isFixtureCanonicalUrl('https://zoo.taipei.gov.tw/x'), false);
  });
});

describe('fixture region global-dogpark', () => {
  it('global-dogpark-001 顯示全球區域', () => {
    const raw = FIXTURE_NEWS_RAW.find((f) =>
      f.canonicalUrl.includes('global-dogpark-001'),
    );
    assert.ok(raw);
    assert.equal(raw!.region, 'global');

    const processed = processCandidates(MOCK_NEWS_FIXTURES);
    const dogpark = processed.find((p) => p.canonicalUrl.includes('global-dogpark-001'));
    assert.ok(dogpark);
    assert.equal(dogpark!.region, 'global');
    assert.equal(dogpark!.status, 'AUTO_APPROVED');

    const tw = processed.find((p) => p.canonicalUrl.includes('tw-enrichment-001'));
    assert.ok(tw);
    assert.equal(tw!.region, 'tw');
  });
});

describe('DRAFT joke fixtures 物種覆蓋', () => {
  it('至少含 dog／cat／rabbit／bird，且維持成熟 Bark', () => {
    const species = new Set(
      MORNING_JOKE_DRAFT_FIXTURES.flatMap((f) => f.petTags.filter((t) => t !== 'general')),
    );
    for (const need of ['dog', 'cat', 'rabbit', 'bird']) {
      assert.ok(species.has(need), `missing species ${need}`);
    }
    assert.ok(MORNING_JOKE_DRAFT_FIXTURES.length >= 4);
    for (const f of MORNING_JOKE_DRAFT_FIXTURES) {
      const lint = lintMorningStyle(f.body, { kind: 'joke' });
      assert.equal(lint.ok, true, `${f.stableId}: ${lint.issues.join(',')}`);
      assert.ok(lint.barkCount <= 1, `${f.stableId} bark`);
    }
  });
});
