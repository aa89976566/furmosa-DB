/**
 * 店家身分人工確認：純判定規則。
 * 不改 slug、MER、會員、折價券、訂單、點數或店員歸屬。
 */

export const OTHER_RECORD_DISPOSITIONS = [
  'keep_legacy_link',
  'merge_into_kept',
  'mark_as_branch',
  'retire_and_keep_number',
] as const;

export type OtherRecordDisposition = (typeof OTHER_RECORD_DISPOSITIONS)[number];

export const IDENTITY_VERDICTS = ['same_store', 'test', 'demo'] as const;
export type PartnerStoreIdentityVerdict = (typeof IDENTITY_VERDICTS)[number];

export const IDENTITY_SCOPES = ['preview', 'production'] as const;
export type PartnerStoreIdentityScope = (typeof IDENTITY_SCOPES)[number];

export const OFFICIAL_LIST_EXCLUDED_MERCHANT_IDS = new Set(['MER-OTHER', 'MER-REFILL', 'MER-DEMO']);
export const OFFICIAL_LIST_EXCLUDED_STORE_SLUGS = new Set(['mer_other', 'mer_refill']);

export type PartnerStoreHumanDecision = {
  id: string;
  merchantId: string;
  legacySlug: string | null;
  verdict: PartnerStoreIdentityVerdict;
  decidedByUserId: string;
  decidedByAccount: string;
  decidedByName: string;
  decidedAt: string;
  rationale: string;
  otherRecordDisposition: OtherRecordDisposition;
  createdAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokedByAccount: string | null;
  revokeReason: string | null;
  scope: PartnerStoreIdentityScope;
};

export function identityDecisionScope(
  env: string | undefined = process.env.VERCEL_ENV,
): PartnerStoreIdentityScope {
  return env === 'preview' ? 'preview' : 'production';
}

export function activeHumanDecisions(
  decisions: PartnerStoreHumanDecision[],
): PartnerStoreHumanDecision[] {
  return decisions.filter((decision) => decision.revokedAt == null);
}

export function isOfficialExcludedMerchantId(
  merchantId: string,
  decisions: PartnerStoreHumanDecision[] = [],
): boolean {
  const number = merchantId.trim().toUpperCase();
  if (OFFICIAL_LIST_EXCLUDED_MERCHANT_IDS.has(number)) return true;
  return activeHumanDecisions(decisions).some(
    (decision) =>
      decision.merchantId.toUpperCase() === number &&
      (decision.verdict === 'test' || decision.verdict === 'demo'),
  );
}

export function isOfficialExcludedStoreSlug(
  slug: string,
  decisions: PartnerStoreHumanDecision[] = [],
): boolean {
  const key = slug.trim().toLowerCase();
  if (OFFICIAL_LIST_EXCLUDED_STORE_SLUGS.has(key)) return true;
  return activeHumanDecisions(decisions).some(
    (decision) =>
      decision.legacySlug?.toLowerCase() === key &&
      (decision.verdict === 'test' || decision.verdict === 'demo'),
  );
}

export function confirmedSlugForMerchantId(
  merchantId: string,
  decisions: PartnerStoreHumanDecision[],
): string | null {
  const number = merchantId.trim().toUpperCase();
  const hit = activeHumanDecisions(decisions).find(
    (decision) =>
      decision.verdict === 'same_store' &&
      decision.merchantId.toUpperCase() === number &&
      decision.legacySlug,
  );
  return hit?.legacySlug ?? null;
}

export function confirmedMerchantIdForSlug(
  slug: string,
  decisions: PartnerStoreHumanDecision[],
): string | null {
  const key = slug.trim().toLowerCase();
  const hit = activeHumanDecisions(decisions).find(
    (decision) =>
      decision.verdict === 'same_store' && decision.legacySlug?.toLowerCase() === key,
  );
  return hit?.merchantId ?? null;
}

export const VERDICT_LABEL: Record<PartnerStoreIdentityVerdict, string> = {
  same_store: '同一門市',
  test: '測試',
  demo: '示範',
};
