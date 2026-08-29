import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

/**
 * 匠寵店家身分規則（不連資料庫）。
 *
 * 唯一店家編號 = 寄賣 Merchant.merchantId（例 MER-0018）
 * 核銷相容鍵   = Store.slug
 * 自動同一家   = slug === merchantToStoreSlug(merchantId)
 *
 * 店名只用來找出「需要人工確認」的候選，絕不自動合併。
 */

export type IdentityConfidence = 'auto' | 'needs_review' | 'unmatched';

export type IdentityStore = {
  id: string;
  slug: string;
  name: string;
};

export type IdentityMerchant = {
  id: string;
  merchantId: string;
  name: string;
  city: string | null;
  address: string | null;
  status: string;
  types: string[];
};

const LEGAL_SUFFIX_RE = /股份有限公司|有限公司|工作室/g;
const NOISE_RE = /[()（）\[\]【】]|核銷/g;
const BRANCH_RE =
  /(中和|板橋|土城|三重|新莊|新店|汐止|淡水|林口|蘆洲|永和|大安|中山|松山|信義|士林|內湖|文山|北投|中壢|桃園|竹北|新竹|台中|臺中|台南|臺南|高雄)店?/g;

/** 給人看的唯一店家編號。舊寄賣店沿用這個欄位，不另發明第三套編號。 */
export function canonicalStoreNumber(merchantId: string): string {
  return merchantId.trim().toUpperCase();
}

/** 由唯一編號推導核銷 slug。MER-0018 → mer_0018 */
export function derivedRedeemSlug(merchantId: string): string {
  return merchantToStoreSlug(merchantId);
}

export function normalizeRedeemSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/** 唯一自動規則：核銷 slug 等於由寄賣編號推導出的 slug。 */
export function isAutomaticSameStore(storeSlug: string, merchantId: string): boolean {
  return normalizeRedeemSlug(storeSlug) === derivedRedeemSlug(merchantId);
}

/** 比對用店名。去掉空白、括號、有限公司等，不用來自動合併。 */
export function normalizeStoreName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(NOISE_RE, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/[\s\u3000_\-－—·・]+/g, '')
    .toLowerCase();
}

export function normalizeLocation(city: string | null, address: string | null): string {
  return `${city ?? ''}${address ?? ''}`
    .normalize('NFKC')
    .replace(/[\s\u3000_\-－—]+/g, '')
    .toLowerCase();
}

export function extractBranchTokens(name: string): string[] {
  const normalized = normalizeStoreName(name);
  const tokens = new Set<string>();
  for (const match of normalized.matchAll(BRANCH_RE)) {
    tokens.add(match[1] ?? match[0]);
  }
  return [...tokens];
}

function stripBranchTokens(name: string): string {
  return normalizeStoreName(name).replace(BRANCH_RE, '');
}

/**
 * 店名看起來像同一招牌、不同分店。
 * 這類自動判定為「不同店」，不要當成同一家。
 */
export function looksLikeDifferentBranches(a: string, b: string): boolean {
  const branchesA = extractBranchTokens(a);
  const branchesB = extractBranchTokens(b);
  if (branchesA.length === 0 || branchesB.length === 0) return false;
  const shared = branchesA.some((token) => branchesB.includes(token));
  if (shared) return false;
  const stemA = stripBranchTokens(a);
  const stemB = stripBranchTokens(b);
  if (!stemA || !stemB) return false;
  return stemA === stemB || namesLookSimilar(stemA, stemB);
}

/** 正規化後完全相同，或較短名稱至少 4 字且被較長名稱包含。 */
export function namesLookSimilar(a: string, b: string): boolean {
  const left = normalizeStoreName(a);
  const right = normalizeStoreName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 4 && longer.includes(shorter);
}

export function locationsDiffer(
  left: { city: string | null; address: string | null },
  right: { city: string | null; address: string | null },
): boolean {
  const a = normalizeLocation(left.city, left.address);
  const b = normalizeLocation(right.city, right.address);
  return a.length > 0 && b.length > 0 && a !== b;
}

export type StoreMerchantLink = {
  storeId: string;
  storeSlug: string;
  merchantRecordId: string;
  merchantId: string;
  confidence: IdentityConfidence;
  reason:
    | 'slug_matches_merchant_id'
    | 'same_name'
    | 'similar_name'
    | 'same_name_different_location'
    | 'different_branch';
};

export function classifyStoreMerchantPair(
  store: IdentityStore,
  merchant: IdentityMerchant,
): StoreMerchantLink | null {
  if (isAutomaticSameStore(store.slug, merchant.merchantId)) {
    return {
      storeId: store.id,
      storeSlug: store.slug,
      merchantRecordId: merchant.id,
      merchantId: merchant.merchantId,
      confidence: 'auto',
      reason: 'slug_matches_merchant_id',
    };
  }

  if (looksLikeDifferentBranches(store.name, merchant.name)) {
    return {
      storeId: store.id,
      storeSlug: store.slug,
      merchantRecordId: merchant.id,
      merchantId: merchant.merchantId,
      confidence: 'unmatched',
      reason: 'different_branch',
    };
  }

  if (!namesLookSimilar(store.name, merchant.name)) return null;

  const exact = normalizeStoreName(store.name) === normalizeStoreName(merchant.name);
  return {
    storeId: store.id,
    storeSlug: store.slug,
    merchantRecordId: merchant.id,
    merchantId: merchant.merchantId,
    confidence: 'needs_review',
    reason: exact ? 'same_name' : 'similar_name',
  };
}

export function linkStoresAndMerchants(
  stores: IdentityStore[],
  merchants: IdentityMerchant[],
): StoreMerchantLink[] {
  const links: StoreMerchantLink[] = [];
  for (const store of stores) {
    for (const merchant of merchants) {
      const link = classifyStoreMerchantPair(store, merchant);
      if (link) links.push(link);
    }
  }
  return links;
}

export function autoLinkedStoreIds(links: StoreMerchantLink[]): Set<string> {
  return new Set(
    links.filter((link) => link.confidence === 'auto').map((link) => link.storeId),
  );
}

export function autoLinkedMerchantRecordIds(links: StoreMerchantLink[]): Set<string> {
  return new Set(
    links.filter((link) => link.confidence === 'auto').map((link) => link.merchantRecordId),
  );
}

export const HUMAN_REVIEW_OWNER = 'hq';

export const PARTNER_STORE_IDENTITY_RULES = {
  uniqueNumber: 'Merchant.merchantId',
  redeemKey: 'Store.slug',
  automaticSameStore: 'store.slug === merchantToStoreSlug(merchant.merchantId)',
  posAccountHangsOn: 'Merchant.id / Merchant.merchantId',
  lineAndStoreReportUse: 'Store.slug',
  humanReviewOwner: HUMAN_REVIEW_OWNER,
  neverAutoMergeByName: true,
} as const;
