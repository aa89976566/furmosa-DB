import type { PartnerStoreHumanDecision } from '@/lib/jar-exchange/partner-store-identity-decisions';

export function decisionFixture(
  partial: Pick<PartnerStoreHumanDecision, 'id' | 'merchantId' | 'legacySlug' | 'verdict' | 'rationale'> &
    Partial<PartnerStoreHumanDecision>,
): PartnerStoreHumanDecision {
  return {
    decidedByUserId: 'user_admin',
    decidedByAccount: 'admin@furmosa.com',
    decidedByName: '陳管理員',
    decidedAt: '2026-08-29T21:15:00.000Z',
    createdAt: '2026-08-29T21:15:00.000Z',
    otherRecordDisposition: 'keep_legacy_link',
    revokedAt: null,
    revokedByUserId: null,
    revokedByAccount: null,
    revokeReason: null,
    scope: 'preview',
    ...partial,
  };
}

export function previewBootstrapDecisions(): PartnerStoreHumanDecision[] {
  return [
    decisionFixture({
      id: 'd1',
      merchantId: 'MER-0019',
      legacySlug: 'zhuwo_banqiao',
      verdict: 'same_store',
      rationale: '豬窩板橋',
    }),
    decisionFixture({
      id: 'd2',
      merchantId: 'MER-0020',
      legacySlug: 'zhuwo_tucheng',
      verdict: 'same_store',
      rationale: '豬窩土城',
    }),
    decisionFixture({
      id: 'd3',
      merchantId: 'MER-0016',
      legacySlug: 'zhuwo_zhonghe',
      verdict: 'same_store',
      rationale: '豬窩中和',
    }),
    decisionFixture({
      id: 'd4',
      merchantId: 'MER-0017',
      legacySlug: 'manlisa',
      verdict: 'same_store',
      rationale: '曼利莎',
    }),
    decisionFixture({
      id: 'd5',
      merchantId: 'MER-0010',
      legacySlug: 'niuniu',
      verdict: 'same_store',
      rationale: '淡水妞妞',
    }),
    decisionFixture({
      id: 'd6',
      merchantId: 'MER-OTHER',
      legacySlug: 'mer_other',
      verdict: 'test',
      rationale: '系統／測試',
    }),
    decisionFixture({
      id: 'd7',
      merchantId: 'MER-REFILL',
      legacySlug: 'mer_refill',
      verdict: 'test',
      rationale: '測試',
    }),
    decisionFixture({
      id: 'd8',
      merchantId: 'MER-DEMO',
      legacySlug: null,
      verdict: 'demo',
      rationale: '示範',
    }),
  ];
}
