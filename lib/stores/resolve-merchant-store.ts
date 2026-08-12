/**
 * Merchant → Store 純解析（P0 設計鎖規格）。
 *
 * - 零 DB／零 side effect；候選 Stores 由呼叫端注入。
 * - 不得建立或同步 Store。
 * - 友好／豬窩 alias：僅版本控制 allowlist，(merchantId + merchant name) 必須同時匹配。
 * - 候選 Store 必須同時 slug 與 name 命中目標；缺一不可。
 * - 一般 mer_xxxx：僅允許 business ID 導出 slug，且 Store.name 必須等於 Merchant.name。
 * - 禁止「任意 merchantId 只靠店名」授權。
 */

import { isInternalMerchantId } from '@/lib/stores/partner-store-visibility';
import { ZHUWO_CONSIGNMENT_BRANCHES } from '@/lib/stores/zhuwo-branches';

export type MerchantResolveInput = {
  /** Merchant.id（cuid）；本函式不依此查表，僅保留呼叫端語意 */
  id: string;
  /** 業務編號 MER-xxxx */
  merchantId: string;
  name: string;
  status: string;
  /** 須含 jar_exchange 才可核銷映射 */
  types: readonly string[];
};

export type StoreCandidate = {
  id: string;
  slug: string;
  name: string;
};

export type MerchantStoreResolveDenyReason =
  | 'inactive'
  | 'not_jar_exchange'
  | 'internal_merchant'
  | 'missing_store'
  | 'ambiguous'
  | 'name_conflict'
  | 'allowlist_mismatch';

export type MerchantStoreResolveResult =
  | {
      ok: true;
      store: StoreCandidate;
      matchedBy: 'allowlist' | 'derived_slug';
    }
  | {
      ok: false;
      reason: MerchantStoreResolveDenyReason;
    };

export type MerchantStoreAllowlistPair = {
  merchantId: string;
  merchantName: string;
  storeSlug: string;
  storeName: string;
};

/** 與 lib/stores/sync-merchant-stores.ts 相同規則（純字串，不 import sync 以免拉進 prisma）。 */
export function merchantToStoreSlug(merchantId: string): string {
  return merchantId.trim().toLowerCase().replace(/-/g, '_');
}

export function normalizeMerchantId(merchantId: string): string {
  return merchantId.trim().toUpperCase();
}

export function normalizeStoreName(name: string): string {
  return name.trim();
}

function namesEqual(a: string, b: string): boolean {
  return normalizeStoreName(a) === normalizeStoreName(b);
}

/**
 * 明確 allowlist：(normalized MER, exact merchant name) → expected store slug + store name。
 * - 豬窩：ZHUWO_CONSIGNMENT_BRANCHES
 * - 淡水妞妞／曼利莎：Production 唯讀核對之唯一 MER+name→slug（2026-08-12）
 * - 柒沐／墨菲：FALLBACK slug 即 mer_xxxx，與 business ID 對齊
 * - pet99：Production 無對應 Merchant／MER → 禁止列入，fail closed
 */
export const MERCHANT_STORE_ALLOWLIST: readonly MerchantStoreAllowlistPair[] = [
  ...ZHUWO_CONSIGNMENT_BRANCHES.map((b) => ({
    merchantId: b.merchantId,
    merchantName: b.name,
    storeSlug: b.storeSlug,
    storeName: b.name,
  })),
  {
    merchantId: 'MER-0010',
    merchantName: '淡水妞妞',
    storeSlug: 'niuniu',
    storeName: '淡水妞妞',
  },
  {
    merchantId: 'MER-0017',
    merchantName: '曼利莎寵物美容',
    storeSlug: 'manlisa',
    storeName: '曼利莎寵物美容',
  },
  {
    merchantId: 'MER-0014',
    merchantName: '柒沐寵物美容',
    storeSlug: 'mer_0014',
    storeName: '柒沐寵物美容',
  },
  {
    merchantId: 'MER-0018',
    merchantName: '墨菲寵物美學',
    storeSlug: 'mer_0018',
    storeName: '墨菲寵物美學',
  },
] as const;

function findAllowlistPair(
  merchantId: string,
  merchantName: string,
): MerchantStoreAllowlistPair | undefined {
  const id = normalizeMerchantId(merchantId);
  return MERCHANT_STORE_ALLOWLIST.find(
    (p) => normalizeMerchantId(p.merchantId) === id && namesEqual(p.merchantName, merchantName),
  );
}

function allowlistTouchesMerchantOrName(merchantId: string, merchantName: string): boolean {
  const id = normalizeMerchantId(merchantId);
  return MERCHANT_STORE_ALLOWLIST.some(
    (p) =>
      normalizeMerchantId(p.merchantId) === id || namesEqual(p.merchantName, merchantName),
  );
}

/**
 * 候選必須同時符合 target slug 與 target store name。
 * - slug 命中但 name 不符 → name_conflict
 * - name 命中但 slug 不符 → name_conflict
 * - 多筆／重複 id|slug → ambiguous
 */
function pickExactCandidate(
  candidates: readonly StoreCandidate[],
  targetSlug: string,
  targetStoreName: string,
): MerchantStoreResolveResult {
  const slugHits = candidates.filter((s) => s.slug === targetSlug);
  const nameHits = candidates.filter((s) => namesEqual(s.name, targetStoreName));

  if (slugHits.length === 0 && nameHits.length === 0) {
    return { ok: false, reason: 'missing_store' };
  }

  if (slugHits.length > 1 || nameHits.length > 1) {
    return { ok: false, reason: 'ambiguous' };
  }

  if (slugHits.length === 1 && nameHits.length === 1) {
    if (slugHits[0]!.id !== nameHits[0]!.id) {
      return { ok: false, reason: 'name_conflict' };
    }
    const store = slugHits[0]!;
    if (!namesEqual(store.name, targetStoreName) || store.slug !== targetSlug) {
      return { ok: false, reason: 'name_conflict' };
    }
    return { ok: true, store, matchedBy: 'allowlist' };
  }

  // 僅 slug 或僅 name 命中 → 另一半不符
  return { ok: false, reason: 'name_conflict' };
}

function pickDerivedCandidate(
  candidates: readonly StoreCandidate[],
  derivedSlug: string,
  merchantName: string,
): MerchantStoreResolveResult {
  // 僅以 derived slug 為入口；禁止「只靠店名」命中其他友好 slug。
  const slugHits = candidates.filter((s) => s.slug === derivedSlug);
  if (slugHits.length === 0) {
    return { ok: false, reason: 'missing_store' };
  }
  if (slugHits.length > 1) {
    return { ok: false, reason: 'ambiguous' };
  }
  const store = slugHits[0]!;
  if (!namesEqual(store.name, merchantName)) {
    return { ok: false, reason: 'name_conflict' };
  }
  const nameHits = candidates.filter((s) => namesEqual(s.name, merchantName));
  if (nameHits.length > 1) {
    return { ok: false, reason: 'ambiguous' };
  }
  if (nameHits.length === 1 && nameHits[0]!.id !== store.id) {
    return { ok: false, reason: 'name_conflict' };
  }
  return { ok: true, store, matchedBy: 'derived_slug' };
}

/**
 * 將 active jar_exchange Merchant 解析為唯一可核銷 Store。
 * `candidates` 應為呼叫端已讀取的 Store 清單；本函式絕不新增／更新。
 */
export function resolveMerchantStore(
  merchant: MerchantResolveInput,
  candidates: readonly StoreCandidate[],
): MerchantStoreResolveResult {
  if (merchant.status.trim() !== 'active') {
    return { ok: false, reason: 'inactive' };
  }
  if (!merchant.types.includes('jar_exchange')) {
    return { ok: false, reason: 'not_jar_exchange' };
  }
  if (isInternalMerchantId(merchant.merchantId)) {
    return { ok: false, reason: 'internal_merchant' };
  }

  const pair = findAllowlistPair(merchant.merchantId, merchant.name);
  if (pair) {
    const picked = pickExactCandidate(candidates, pair.storeSlug, pair.storeName);
    if (!picked.ok) return picked;
    return { ok: true, store: picked.store, matchedBy: 'allowlist' };
  }

  // MER 或店名出現在 allowlist 但 pair 不成 → 拒絕（含未知 MER + 合法豬窩／友好店名）
  if (allowlistTouchesMerchantOrName(merchant.merchantId, merchant.name)) {
    return { ok: false, reason: 'allowlist_mismatch' };
  }

  // 非 allowlist：僅允許 derived mer_xxxx，且 Store.name 必須等於 Merchant.name
  const derivedSlug = merchantToStoreSlug(merchant.merchantId);
  return pickDerivedCandidate(candidates, derivedSlug, merchant.name);
}
