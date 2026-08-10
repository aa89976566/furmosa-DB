import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decideMorningContent,
  resolveAlternatePrimaryIntent,
} from '@/lib/line/morning/domain/decision';

describe('Phase 4B-C alternate advancement', () => {
  it('無歷史 → HUMOR；HUMOR SUCCESS → NEWS；NEWS SUCCESS → HUMOR', () => {
    assert.equal(resolveAlternatePrimaryIntent({ lastSuccessContentType: null }), 'HUMOR');
    assert.equal(
      resolveAlternatePrimaryIntent({ lastSuccessContentType: 'HUMOR' }),
      'NEWS',
    );
    assert.equal(
      resolveAlternatePrimaryIntent({ lastSuccessContentType: 'NEWS' }),
      'HUMOR',
    );
  });

  it('NEWS 缺合格來源 → SKIP；不暗換 HUMOR（next 仍視為 NEWS 回合）', () => {
    const d = decideMorningContent({
      contentMode: 'alternate',
      taipeiDate: '2026-08-10',
      lastSuccessContentType: 'HUMOR',
      availability: { hasSafeNews: false, hasHumor: true, hasAnimalFact: true },
    });
    assert.equal(d.outcome, 'SKIP');
    if (d.outcome === 'SKIP') {
      assert.equal(d.reason, 'no_safe_news');
      assert.equal(d.attempted, 'NEWS');
    }
    // 下一回合若仍無 SENT SUCCESS，primary 仍是 NEWS
    assert.equal(
      resolveAlternatePrimaryIntent({ lastSuccessContentType: 'HUMOR' }),
      'NEWS',
    );
  });
});
