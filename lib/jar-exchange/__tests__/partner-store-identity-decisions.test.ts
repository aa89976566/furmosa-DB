import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HUMAN_DECISION_REQUIRED_FIELDS,
  activeHumanDecisions,
  confirmedMerchantIdForSlug,
  identityDecisionScope,
  isOfficialExcludedMerchantId,
  isPreviewIdentityEnv,
  isTestOperatingRefill,
  listOfficialOneToOnePairs,
  missingHumanDecisionFields,
  revokeHumanDecision,
  shouldInsertBootstrapDecision,
} from '@/lib/jar-exchange/partner-store-identity-decisions';
import { decisionFixture, previewBootstrapDecisions } from './identity-decision-fixture';

describe('partner store identity decision records', () => {
  it('requires confirmer account and history fields instead of a hardcoded name', () => {
    const saved = previewBootstrapDecisions();
    assert.equal(saved.filter((row) => row.verdict === 'same_store').length, 5);
    for (const row of saved.filter((item) => item.verdict === 'same_store')) {
      assert.equal(missingHumanDecisionFields(row).length, 0);
      assert.equal(row.decidedByAccount, 'admin@furmosa.com');
      assert.ok(row.decidedByUserId);
      assert.ok(row.createdAt);
      assert.equal(row.revokedAt, null);
    }
    assert.deepEqual(HUMAN_DECISION_REQUIRED_FIELDS, [
      'merchantId',
      'verdict',
      'decidedByUserId',
      'decidedByAccount',
      'decidedAt',
      'rationale',
      'otherRecordDisposition',
      'createdAt',
    ]);
  });

  it('excludes only active test and demo records from official counts', () => {
    const saved = previewBootstrapDecisions();
    assert.equal(isOfficialExcludedMerchantId('MER-OTHER', saved), true);
    assert.equal(isOfficialExcludedMerchantId('MER-REFILL', saved), true);
    assert.equal(isOfficialExcludedMerchantId('MER-DEMO', saved), true);
    assert.equal(isOfficialExcludedMerchantId('MER-0015', saved), false);
    assert.equal(isOfficialExcludedMerchantId('MER-0011', []), false);
  });

  it('counts official one-to-one as 3 slug matches plus 5 active confirmations', () => {
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
      decisions: previewBootstrapDecisions(),
    });
    assert.equal(pairs.length, 8);
    assert.equal(pairs.filter((pair) => pair.source === 'slug_match').length, 3);
    assert.equal(pairs.filter((pair) => pair.source === 'human_confirmed').length, 5);
    assert.equal(
      pairs.some((pair) => pair.slug === 'pet99' || pair.merchantId === 'MER-0015'),
      false,
    );
  });

  it('keeps the original confirmation after revoke and restores pending classification', () => {
    const saved = previewBootstrapDecisions();
    const revoked = revokeHumanDecision(saved, 'd5', {
      revokedAt: '2026-08-29T22:00:00.000Z',
      revokedByUserId: 'user_ops',
      revokedByAccount: 'ops@furmosa.com',
      revokeReason: '驗收撤銷妞妞',
    });
    const original = revoked.find((row) => row.id === 'd5');
    assert.ok(original);
    assert.equal(original?.rationale, '淡水妞妞');
    assert.equal(original?.decidedByAccount, 'admin@furmosa.com');
    assert.equal(original?.revokedByAccount, 'ops@furmosa.com');
    assert.equal(original?.revokeReason, '驗收撤銷妞妞');
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
    assert.equal(activeHumanDecisions(revoked).some((row) => row.id === 'd5'), false);
  });

  it('does not auto-insert bootstrap again after a revoked history row exists', () => {
    const revoked = decisionFixture({
      id: 'old-niuniu',
      merchantId: 'MER-0010',
      legacySlug: 'niuniu',
      verdict: 'same_store',
      rationale: '舊確認',
      revokedAt: '2026-08-29T22:00:00.000Z',
      revokedByAccount: 'ops@furmosa.com',
      revokeReason: '驗收',
    });
    assert.equal(
      shouldInsertBootstrapDecision([revoked], {
        merchantId: 'MER-0010',
        legacySlug: 'niuniu',
        scope: 'preview',
      }),
      false,
    );
    assert.equal(
      shouldInsertBootstrapDecision([revoked], {
        merchantId: 'MER-0019',
        legacySlug: 'zhuwo_banqiao',
        scope: 'preview',
      }),
      true,
    );
  });

  it('uses preview scope only on Vercel Preview', () => {
    assert.equal(identityDecisionScope('preview'), 'preview');
    assert.equal(identityDecisionScope('production'), 'production');
    assert.equal(identityDecisionScope(undefined), 'production');
    assert.equal(isPreviewIdentityEnv('preview'), true);
    assert.equal(isPreviewIdentityEnv('production'), false);
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
