/**
 * 店家身分人工確認：純判定規則。
 * 配對與測試店名單不寫死在此；呼叫端必須傳入資料庫紀錄。
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

export const HUMAN_DECISION_REQUIRED_FIELDS = [
  'merchantId',
  'verdict',
  'decidedByUserId',
  'decidedByAccount',
  'decidedAt',
  'rationale',
  'otherRecordDisposition',
  'createdAt',
] as const;

export type HumanDecisionRequiredField = (typeof HUMAN_DECISION_REQUIRED_FIELDS)[number];

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
  /** Preview 只讀對照，不是資料庫列 */
  displayOnly?: boolean;
};

export function identityDecisionScope(
  env: string | undefined = process.env.VERCEL_ENV,
): PartnerStoreIdentityScope {
  return env === 'preview' ? 'preview' : 'production';
}

export function isPreviewIdentityEnv(
  env: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return env === 'preview';
}

export function missingHumanDecisionFields(
  input: Partial<Record<HumanDecisionRequiredField, string | undefined>>,
): HumanDecisionRequiredField[] {
  return HUMAN_DECISION_REQUIRED_FIELDS.filter((field) => {
    const value = input[field];
    if (field === 'otherRecordDisposition') {
      return !OTHER_RECORD_DISPOSITIONS.includes(value as OtherRecordDisposition);
    }
    if (field === 'verdict') {
      return !IDENTITY_VERDICTS.includes(value as PartnerStoreIdentityVerdict);
    }
    return typeof value !== 'string' || value.trim() === '';
  });
}

export function activeHumanDecisions(
  decisions: PartnerStoreHumanDecision[],
): PartnerStoreHumanDecision[] {
  return decisions.filter((decision) => decision.revokedAt == null);
}

/** 撤銷一筆確認：回傳新陣列，不刪原列、不改正式店家資料。 */
export function revokeHumanDecision(
  decisions: PartnerStoreHumanDecision[],
  id: string,
  input: { revokedAt: string; revokedByUserId: string; revokedByAccount: string; revokeReason: string },
): PartnerStoreHumanDecision[] {
  const reason = input.revokeReason.trim();
  if (!reason) return decisions;
  return decisions.map((decision) => {
    if (decision.id !== id || decision.revokedAt) return decision;
    return {
      ...decision,
      revokedAt: input.revokedAt,
      revokedByUserId: input.revokedByUserId,
      revokedByAccount: input.revokedByAccount,
      revokeReason: reason,
    };
  });
}

export function isOfficialExcludedMerchantId(
  merchantId: string,
  decisions: PartnerStoreHumanDecision[],
): boolean {
  const number = merchantId.trim().toUpperCase();
  return activeHumanDecisions(decisions).some(
    (decision) =>
      decision.merchantId.toUpperCase() === number &&
      (decision.verdict === 'test' || decision.verdict === 'demo'),
  );
}

export function isOfficialExcludedStoreSlug(
  slug: string,
  decisions: PartnerStoreHumanDecision[],
): boolean {
  const key = slug.trim().toLowerCase();
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

export function activeSameStoreDecisionForSlug(
  slug: string,
  decisions: PartnerStoreHumanDecision[],
): PartnerStoreHumanDecision | null {
  const key = slug.trim().toLowerCase();
  return (
    activeHumanDecisions(decisions).find(
      (decision) =>
        decision.verdict === 'same_store' && decision.legacySlug?.toLowerCase() === key,
    ) ?? null
  );
}

const MER_SLUG_RE = /^mer_(\d+)$/;

export function storeNumberFromRedeemSlug(slug: string): string | null {
  const match = slug.trim().toLowerCase().match(MER_SLUG_RE);
  if (!match) return null;
  return `MER-${match[1]}`;
}

export type OfficialIdentityPair = {
  slug: string;
  merchantId: string;
  source: 'slug_match' | 'human_confirmed';
};

/** 正式一對一門市：安全 slug 對應＋未撤銷的總部確認。測試店不計入。 */
export function listOfficialOneToOnePairs(input: {
  storeSlugs: string[];
  merchantIds: string[];
  decisions: PartnerStoreHumanDecision[];
}): OfficialIdentityPair[] {
  const decisions = input.decisions;
  const slugs = new Set(input.storeSlugs.map((slug) => slug.trim().toLowerCase()));
  const numbers = new Set(input.merchantIds.map((id) => id.trim().toUpperCase()));
  const pairs: OfficialIdentityPair[] = [];
  const usedSlugs = new Set<string>();
  const usedNumbers = new Set<string>();

  for (const slug of slugs) {
    if (isOfficialExcludedStoreSlug(slug, decisions)) continue;
    const reversed = storeNumberFromRedeemSlug(slug);
    if (!reversed || !numbers.has(reversed) || isOfficialExcludedMerchantId(reversed, decisions)) {
      continue;
    }
    pairs.push({ slug, merchantId: reversed, source: 'slug_match' });
    usedSlugs.add(slug);
    usedNumbers.add(reversed);
  }

  for (const decision of activeHumanDecisions(decisions)) {
    if (decision.verdict !== 'same_store' || !decision.legacySlug) continue;
    const slug = decision.legacySlug.toLowerCase();
    const merchantId = decision.merchantId.toUpperCase();
    if (!slugs.has(slug) || !numbers.has(merchantId)) continue;
    if (usedSlugs.has(slug) || usedNumbers.has(merchantId)) continue;
    if (isOfficialExcludedMerchantId(merchantId, decisions)) continue;
    pairs.push({ slug, merchantId, source: 'human_confirmed' });
    usedSlugs.add(slug);
    usedNumbers.add(merchantId);
  }

  return pairs;
}

/**
 * 測試換罐標記。不從財務／金流對帳隱藏金額。
 * 僅供正式合作門市與營運 KPI 排除。
 */
export const TEST_REFILL_MARKERS = {
  merchantId: 'MER-REFILL',
  displayOrderNo: '#RFP-260729-12Z5',
  seedAction: 'seed_paid_waiting_order',
} as const;

export function isTestOperatingRefill(input: {
  merchantBusinessId?: string | null;
  displayOrderNo?: string | null;
  seedAction?: string | null;
  providerTradeNo?: string | null;
}): boolean {
  if (input.merchantBusinessId?.toUpperCase() === TEST_REFILL_MARKERS.merchantId) return true;
  if (input.displayOrderNo === TEST_REFILL_MARKERS.displayOrderNo) return true;
  if (input.seedAction === TEST_REFILL_MARKERS.seedAction) return true;
  const trade = (input.providerTradeNo ?? '').trim().toUpperCase();
  return trade === 'SEED-TEST' || trade.startsWith('SEED');
}

export function shouldInsertBootstrapDecision(
  existing: Array<Pick<PartnerStoreHumanDecision, 'merchantId' | 'legacySlug' | 'scope'>>,
  candidate: Pick<PartnerStoreHumanDecision, 'merchantId' | 'legacySlug' | 'scope'>,
): boolean {
  return !existing.some(
    (row) =>
      row.scope === candidate.scope &&
      row.merchantId.toUpperCase() === candidate.merchantId.toUpperCase() &&
      (row.legacySlug ?? '').toLowerCase() === (candidate.legacySlug ?? '').toLowerCase(),
  );
}

export const VERDICT_LABEL: Record<PartnerStoreIdentityVerdict, string> = {
  same_store: '同一門市',
  test: '測試',
  demo: '示範',
};
