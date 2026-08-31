import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPROVED_PARTNER_STORE_COUNT,
  APPROVED_PARTNER_STORE_PAIRS,
} from '@/lib/jar-exchange/partner-store-approved-five';

describe('approved partner store pairs', () => {
  it('contains exactly the five locked one-to-one decisions', () => {
    assert.equal(APPROVED_PARTNER_STORE_COUNT, 5);
    assert.deepEqual(
      APPROVED_PARTNER_STORE_PAIRS.map(({ merchantId, legacySlug }) => [merchantId, legacySlug]),
      [
        ['MER-0019', 'zhuwo_banqiao'],
        ['MER-0020', 'zhuwo_tucheng'],
        ['MER-0016', 'zhuwo_zhonghe'],
        ['MER-0017', 'manlisa'],
        ['MER-0010', 'niuniu'],
      ],
    );
  });

  it('has unique MER, unique slug, and a human confirmation basis for every row', () => {
    assert.equal(new Set(APPROVED_PARTNER_STORE_PAIRS.map((row) => row.merchantId)).size, 5);
    assert.equal(new Set(APPROVED_PARTNER_STORE_PAIRS.map((row) => row.legacySlug)).size, 5);
    assert.equal(APPROVED_PARTNER_STORE_PAIRS.every((row) => row.rationale.length > 20), true);
  });
});
