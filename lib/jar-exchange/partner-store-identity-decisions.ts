/**
 * 總部人工確認與測試標記（2026-08-29）。
 * 只保存判定，不改 slug、MER、會員、折價券、訂單、點數或店員歸屬。
 * 不寫入正式資料庫。
 */

export const OTHER_RECORD_DISPOSITIONS = [
  'keep_legacy_link',
  'merge_into_kept',
  'mark_as_branch',
  'retire_and_keep_number',
] as const;

export type OtherRecordDisposition = (typeof OTHER_RECORD_DISPOSITIONS)[number];

export const HUMAN_DECISION_REQUIRED_FIELDS = [
  'decidedBy',
  'decidedAt',
  'rationale',
  'keptMerchantId',
  'otherRecordId',
  'otherRecordDisposition',
  'revocable',
] as const;

export type HumanDecisionRequiredField = (typeof HUMAN_DECISION_REQUIRED_FIELDS)[number];

export type PartnerStoreDecisionKind =
  | 'confirmed_same_store'
  | 'test_system'
  | 'test'
  | 'demo';

export type PartnerStoreHumanDecision = {
  id: string;
  kind: PartnerStoreDecisionKind;
  decidedBy: string;
  decidedAt: string;
  rationale: string;
  keptMerchantId: string;
  legacySlug: string | null;
  otherRecordId: string;
  otherRecordDisposition: OtherRecordDisposition;
  revocable: true;
  revokedAt: string | null;
  revokedBy: string | null;
};

const HQ = '匠寵總部';
const DECIDED_AT = '2026-08-29T21:15:00.000Z';

function confirmedSameStore(
  id: string,
  slug: string,
  merchantId: string,
  rationale: string,
): PartnerStoreHumanDecision {
  return {
    id,
    kind: 'confirmed_same_store',
    decidedBy: HQ,
    decidedAt: DECIDED_AT,
    rationale,
    keptMerchantId: merchantId,
    legacySlug: slug,
    otherRecordId: slug,
    otherRecordDisposition: 'keep_legacy_link',
    revocable: true,
    revokedAt: null,
    revokedBy: null,
  };
}

function testFlag(
  id: string,
  kind: Exclude<PartnerStoreDecisionKind, 'confirmed_same_store'>,
  merchantId: string,
  slug: string | null,
  rationale: string,
): PartnerStoreHumanDecision {
  return {
    id,
    kind,
    decidedBy: HQ,
    decidedAt: DECIDED_AT,
    rationale,
    keptMerchantId: merchantId,
    legacySlug: slug,
    otherRecordId: slug ?? merchantId,
    otherRecordDisposition: 'keep_legacy_link',
    revocable: true,
    revokedAt: null,
    revokedBy: null,
  };
}

/** 已保存的總部判定。撤銷時請用 revokeHumanDecision，不要刪列。 */
export const SAVED_PARTNER_STORE_DECISIONS: PartnerStoreHumanDecision[] = [
  confirmedSameStore(
    'confirm-zhuwo-banqiao',
    'zhuwo_banqiao',
    'MER-0019',
    '總部人工判斷：豬窩板橋門市。舊核銷 zhuwo_banqiao 與 MER-0019 為同一家；與土城、中和分開。',
  ),
  confirmedSameStore(
    'confirm-zhuwo-tucheng',
    'zhuwo_tucheng',
    'MER-0020',
    '總部人工判斷：豬窩土城門市。舊核銷 zhuwo_tucheng 與 MER-0020 為同一家；與板橋、中和分開。',
  ),
  confirmedSameStore(
    'confirm-zhuwo-zhonghe',
    'zhuwo_zhonghe',
    'MER-0016',
    '總部人工判斷：豬窩中和門市。舊核銷 zhuwo_zhonghe 與 MER-0016 為同一家；與板橋、土城分開。',
  ),
  confirmedSameStore(
    'confirm-manlisa',
    'manlisa',
    'MER-0017',
    '總部人工判斷：曼利莎寵物美容。舊核銷 manlisa 與 MER-0017 為同一家。',
  ),
  confirmedSameStore(
    'confirm-niuniu',
    'niuniu',
    'MER-0010',
    '總部人工判斷：淡水妞妞。舊核銷 niuniu 與 MER-0010 為同一家。',
  ),
  testFlag(
    'flag-mer-other',
    'test_system',
    'MER-OTHER',
    'mer_other',
    '總部人工判斷：錯誤店家對照，系統／測試資料。不刪除。',
  ),
  testFlag(
    'flag-mer-refill',
    'test',
    'MER-REFILL',
    'mer_refill',
    '總部人工判斷：匠寵換罐測試店。不刪除。測試換罐 #RFP-260729-12Z5 不計正式合作門市與營運 KPI。',
  ),
  testFlag(
    'flag-mer-demo',
    'demo',
    'MER-DEMO',
    null,
    '總部人工判斷：Furmosa Preview 示範店。不刪除、不新增核銷 slug。',
  ),
];

export function missingHumanDecisionFields(
  input: Partial<Record<HumanDecisionRequiredField, string | boolean | undefined>>,
): HumanDecisionRequiredField[] {
  return HUMAN_DECISION_REQUIRED_FIELDS.filter((field) => {
    const value = input[field];
    if (field === 'otherRecordDisposition') {
      return !OTHER_RECORD_DISPOSITIONS.includes(value as OtherRecordDisposition);
    }
    if (field === 'revocable') return value !== true;
    return typeof value !== 'string' || value.trim() === '';
  });
}

export function activeHumanDecisions(
  decisions: PartnerStoreHumanDecision[] = SAVED_PARTNER_STORE_DECISIONS,
): PartnerStoreHumanDecision[] {
  return decisions.filter((decision) => decision.revokedAt == null);
}

/** 撤銷一筆確認：回傳新陣列，不改正式資料列。 */
export function revokeHumanDecision(
  decisions: PartnerStoreHumanDecision[],
  id: string,
  revokedAt: string,
  revokedBy: string,
): PartnerStoreHumanDecision[] {
  return decisions.map((decision) => {
    if (decision.id !== id || !decision.revocable) return decision;
    return { ...decision, revokedAt, revokedBy };
  });
}

export function isOfficialExcludedMerchantId(
  merchantId: string,
  decisions: PartnerStoreHumanDecision[] = SAVED_PARTNER_STORE_DECISIONS,
): boolean {
  const number = merchantId.trim().toUpperCase();
  return activeHumanDecisions(decisions).some(
    (decision) =>
      decision.keptMerchantId.toUpperCase() === number &&
      (decision.kind === 'test' || decision.kind === 'test_system' || decision.kind === 'demo'),
  );
}

export function isOfficialExcludedStoreSlug(
  slug: string,
  decisions: PartnerStoreHumanDecision[] = SAVED_PARTNER_STORE_DECISIONS,
): boolean {
  const key = slug.trim().toLowerCase();
  return activeHumanDecisions(decisions).some(
    (decision) =>
      decision.legacySlug?.toLowerCase() === key &&
      (decision.kind === 'test' || decision.kind === 'test_system' || decision.kind === 'demo'),
  );
}

export function confirmedSlugForMerchantId(
  merchantId: string,
  decisions: PartnerStoreHumanDecision[] = SAVED_PARTNER_STORE_DECISIONS,
): string | null {
  const number = merchantId.trim().toUpperCase();
  const hit = activeHumanDecisions(decisions).find(
    (decision) =>
      decision.kind === 'confirmed_same_store' &&
      decision.keptMerchantId.toUpperCase() === number &&
      decision.legacySlug,
  );
  return hit?.legacySlug ?? null;
}

export function confirmedMerchantIdForSlug(
  slug: string,
  decisions: PartnerStoreHumanDecision[] = SAVED_PARTNER_STORE_DECISIONS,
): string | null {
  const key = slug.trim().toLowerCase();
  const hit = activeHumanDecisions(decisions).find(
    (decision) =>
      decision.kind === 'confirmed_same_store' && decision.legacySlug?.toLowerCase() === key,
  );
  return hit?.keptMerchantId ?? null;
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
  decisions?: PartnerStoreHumanDecision[];
}): OfficialIdentityPair[] {
  const decisions = input.decisions ?? SAVED_PARTNER_STORE_DECISIONS;
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
    if (decision.kind !== 'confirmed_same_store' || !decision.legacySlug) continue;
    const slug = decision.legacySlug.toLowerCase();
    const merchantId = decision.keptMerchantId.toUpperCase();
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
