import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HUMAN_DECISION_REQUIRED_FIELDS,
  SAVED_PARTNER_STORE_DECISIONS,
  activeHumanDecisions,
  confirmedMerchantIdForSlug,
  isOfficialExcludedMerchantId,
  isTestOperatingRefill,
  listOfficialOneToOnePairs,
  missingHumanDecisionFields,
  revokeHumanDecision,
} from '@/lib/jar-exchange/partner-store-identity-decisions';

describe('partner store human decisions', () => {
  it('saves five same-store confirmations with required fields and revocation flag', () => {
    const confirmed = SAVED_PARTNER_STORE_DECISIONS.filter(
      (decision) => decision.kind === 'confirmed_same_store',
    );
    assert.equal(confirmed.length, 5);
    assert.deepEqual(
      confirmed.map((decision) => [decision.legacySlug, decision.keptMerchantId]),
      [
        ['zhuwo_banqiao', 'MER-0019'],
        ['zhuwo_tucheng', 'MER-0020'],
        ['zhuwo_zhonghe', 'MER-0016'],
        ['manlisa', 'MER-0017'],
        ['niuniu', 'MER-0010'],
      ],
    );
    for (const decision of confirmed) {
      assert.equal(
        missingHumanDecisionFields(decision).length,
        0,
        `${decision.id} missing ${missingHumanDecisionFields(decision).join(',')}`,
      );
      assert.equal(decision.revocable, true);
      assert.equal(decision.revokedAt, null);
      assert.equal(decision.otherRecordDisposition, 'keep_legacy_link');
    }
    assert.deepEqual(HUMAN_DECISION_REQUIRED_FIELDS, [
      'decidedBy',
      'decidedAt',
      'rationale',
      'keptMerchantId',
      'otherRecordId',
      'otherRecordDisposition',
      'revocable',
    ]);
  });

  it('saves test and demo flags without deleting records', () => {
    const flags = SAVED_PARTNER_STORE_DECISIONS.filter((decision) => decision.kind !== 'confirmed_same_store');
    assert.equal(flags.length, 3);
    assert.equal(isOfficialExcludedMerchantId('MER-OTHER'), true);
    assert.equal(isOfficialExcludedMerchantId('MER-REFILL'), true);
    assert.equal(isOfficialExcludedMerchantId('MER-DEMO'), true);
    assert.equal(isOfficialExcludedMerchantId('MER-0015'), false);
    assert.equal(isOfficialExcludedMerchantId('MER-0011'), false);
  });

  it('counts official one-to-one as 3 slug matches plus 5 confirmations', () => {
    const pairs = listOfficialOneToOnePairs({
      storeSlugs: [
        'mer_0013',
        'mer_0014',
        'mer_0018',
        'zhuwo_banqiao',
        'zhuwo_tucheng',
        'zhuwo_zhonghe',
        'manlisa',
        'niuniu',
        'pet99',
        'mer_other',
        'mer_refill',
      ],
      merchantIds: [
        'MER-0013',
        'MER-0014',
        'MER-0018',
        'MER-0019',
        'MER-0020',
        'MER-0016',
        'MER-0017',
        'MER-0010',
        'MER-OTHER',
        'MER-REFILL',
        'MER-DEMO',
        'MER-0011',
        'MER-0012',
        'MER-0015',
      ],
    });
    assert.equal(pairs.length, 8);
    assert.equal(pairs.filter((pair) => pair.source === 'slug_match').length, 3);
    assert.equal(pairs.filter((pair) => pair.source === 'human_confirmed').length, 5);
    assert.equal(
      pairs.some((pair) => pair.slug === 'pet99' || pair.merchantId === 'MER-0015'),
      false,
    );
  });

  it('restores pending classification when a confirmation is revoked', () => {
    const revoked = revokeHumanDecision(
      SAVED_PARTNER_STORE_DECISIONS,
      'confirm-niuniu',
      '2026-08-29T22:00:00.000Z',
      '匠寵總部',
    );
    assert.equal(confirmedMerchantIdForSlug('niuniu', revoked), null);
    assert.equal(confirmedMerchantIdForSlug('zhuwo_banqiao', revoked), 'MER-0019');
    const pairs = listOfficialOneToOnePairs({
      storeSlugs: ['niuniu', 'zhuwo_banqiao', 'mer_0018'],
      merchantIds: ['MER-0010', 'MER-0019', 'MER-0018'],
      decisions: revoked,
    });
    assert.deepEqual(
      pairs.map((pair) => pair.slug).sort(),
      ['mer_0018', 'zhuwo_banqiao'],
    );
    assert.equal(activeHumanDecisions(revoked).some((decision) => decision.id === 'confirm-niuniu'), false);
  });

  it('marks the seeded refill as a test operating record without hiding finance fields', () => {
    assert.equal(
      isTestOperatingRefill({
        merchantBusinessId: 'MER-REFILL',
        displayOrderNo: '#RFP-260729-12Z5',
        providerTradeNo: 'SEED-TEST',
        seedAction: 'seed_paid_waiting_order',
      }),
      true,
    );
    assert.equal(
      isTestOperatingRefill({
        merchantBusinessId: 'MER-0010',
        displayOrderNo: '#RFP-260815-ABCD',
        providerTradeNo: 'ECPayReal123',
      }),
      false,
    );
  });
});
