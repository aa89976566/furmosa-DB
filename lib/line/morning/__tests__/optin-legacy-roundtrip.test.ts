import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  toDomainContentMode,
  toStorageContentMode,
  inventsFactMixedConsent,
  alternateAllowsAnimalFactFallback,
} from '@/lib/line/morning/domain/consent';
import {
  getContentOption,
  listContentOptionsForUser,
} from '@/lib/line/morning/domain/optin';

/**
 * 證明舊 alternate／off／unset 不被 migration／選單自動改寫；
 * 僅本人重新 confirm 才換 mode。
 */
describe('Phase 4B-B legacy preference round-trip', () => {
  for (const storage of ['alternate', 'off', 'unset', 'jokes', 'news'] as const) {
    it(`${storage} domain round-trip 不發明 FACT mixed`, () => {
      const domain = toDomainContentMode(storage);
      assert.equal(inventsFactMixedConsent(storage), false);
      if (storage === 'alternate') {
        assert.equal(domain, 'ALTERNATE');
        assert.equal(toStorageContentMode(domain), 'alternate');
        assert.equal(alternateAllowsAnimalFactFallback(domain), false);
      }
      if (storage === 'off') assert.equal(domain, 'OFF');
      if (storage === 'unset') assert.equal(domain, 'UNSET');
    });
  }

  it('非 alternate 使用者選單不含 legacy 選項；alternate 才顯示沿用', () => {
    const normal = listContentOptionsForUser('jokes').map((o) => o.actionId);
    assert.ok(!normal.includes('content_legacy_alternate'));
    const legacy = listContentOptionsForUser('alternate').map((o) => o.actionId);
    assert.ok(legacy.includes('content_legacy_alternate'));
    assert.equal(
      getContentOption('content_legacy_alternate')?.storageMode,
      'alternate',
    );
  });
});
