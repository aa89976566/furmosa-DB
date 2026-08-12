/**
 * Merchant → Store 純解析（P0 設計鎖規格）。
 *
 * - 零 DB／零 side effect；候選 Stores 由呼叫端注入。
 * - 不得建立或同步 Store。
 * - 豬窩：店名匹配為必要條件；MER code 不可單獨授權。
 * - 一般店：derived slug（MER-xxxx → mer_xxxx）或精確店名；衝突／缺漏 fail closed。
 *
 * 對齊 repo：`merchantToStoreSlug`（sync-merchant-stores）、`ZHUWO_CONSIGNMENT_BRANCHES`。
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
  | 'zhuwo_mer_name_mismatch';

export type MerchantStoreResolveResult =
  | {
      ok: true;
      store: StoreCandidate;
      matchedBy: 'zhuwo_name' | 'derived_slug' | 'exact_name';
    }
  | {
      ok: false;
      reason: MerchantStoreResolveDenyReason;
    };

/** 與 lib/stores/sync-merchant-stores.ts 相同規則（純字串，不 import sync 以免拉進 prisma）。 */
export function merchantToStoreSlug(merchantId: string): string {
  return merchantId.trim().toLowerCase().replace(/-/g, '_');
}

function namesEqual(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'zh-Hant', { sensitivity: 'accent' }) === 0;
}

function findZhuwoBranchByName(name: string) {
  return ZHUWO_CONSIGNMENT_BRANCHES.find((b) => namesEqual(b.name, name));
}

function findZhuwoBranchByMerchantId(merchantId: string) {
  const id = merchantId.trim().toUpperCase();
  return ZHUWO_CONSIGNMENT_BRANCHES.find((b) => b.merchantId.toUpperCase() === id);
}

function uniqueOrFail(
  matches: StoreCandidate[],
): { ok: true; store: StoreCandidate } | { ok: false; reason: 'missing_store' | 'ambiguous' } {
  if (matches.length === 0) return { ok: false, reason: 'missing_store' };
  const ids = new Set(matches.map((m) => m.id));
  if (ids.size !== 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, store: matches[0]! };
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

  const zhuwoByName = findZhuwoBranchByName(merchant.name);
  const zhuwoByMer = findZhuwoBranchByMerchantId(merchant.merchantId);

  // MER 屬豬窩偏好碼，但店名不是對應豬窩分店名 → 不可授權任何 zhuwo_*（含 MER-0016 + 非豬窩名）。
  if (zhuwoByMer && !zhuwoByName) {
    return { ok: false, reason: 'zhuwo_mer_name_mismatch' };
  }
  // 店名是豬窩 A，但 MER 是豬窩 B 的偏好碼 → fail closed。
  if (zhuwoByName && zhuwoByMer && zhuwoByName.storeSlug !== zhuwoByMer.storeSlug) {
    return { ok: false, reason: 'zhuwo_mer_name_mismatch' };
  }

  if (zhuwoByName) {
    const matches = candidates.filter(
      (s) => s.slug === zhuwoByName.storeSlug || namesEqual(s.name, zhuwoByName.name),
    );
    const uniq = uniqueOrFail(matches);
    if (!uniq.ok) return uniq;
    // 若同時撞到不同 slug（例如舊 mer_0016 與 zhuwo_zhonghe 同名）→ ambiguous 已由 uniqueOrFail 處理
    if (uniq.store.slug !== zhuwoByName.storeSlug && !namesEqual(uniq.store.name, zhuwoByName.name)) {
      return { ok: false, reason: 'name_conflict' };
    }
    // 名稱匹配到的店必須是目標 zhuwo slug，或同名唯一店；若唯一店 slug 不是 zhuwo 目標且名稱相符，仍允許？
    // 規格：豬窩 alias 以店名匹配為必要，輸出應對應 zhuwo storeSlug。
    if (uniq.store.slug !== zhuwoByName.storeSlug) {
      return { ok: false, reason: 'name_conflict' };
    }
    return { ok: true, store: uniq.store, matchedBy: 'zhuwo_name' };
  }

  const derivedSlug = merchantToStoreSlug(merchant.merchantId);
  const bySlug = candidates.filter((s) => s.slug === derivedSlug);
  const byName = candidates.filter((s) => namesEqual(s.name, merchant.name));

  if (bySlug.length > 0 && byName.length > 0) {
    const slugIds = new Set(bySlug.map((s) => s.id));
    const nameIds = new Set(byName.map((s) => s.id));
    const same =
      slugIds.size === 1 &&
      nameIds.size === 1 &&
      [...slugIds][0] === [...nameIds][0];
    if (!same) {
      return { ok: false, reason: 'name_conflict' };
    }
    return { ok: true, store: bySlug[0]!, matchedBy: 'derived_slug' };
  }

  if (bySlug.length > 0) {
    // slug 命中但店名與 Merchant 不一致 → 名稱衝突（fail closed，避免錯店核銷）
    if (bySlug.length !== 1) return { ok: false, reason: 'ambiguous' };
    if (!namesEqual(bySlug[0]!.name, merchant.name)) {
      return { ok: false, reason: 'name_conflict' };
    }
    return { ok: true, store: bySlug[0]!, matchedBy: 'derived_slug' };
  }

  if (byName.length > 0) {
    const uniq = uniqueOrFail(byName);
    if (!uniq.ok) return uniq;
    return { ok: true, store: uniq.store, matchedBy: 'exact_name' };
  }

  return { ok: false, reason: 'missing_store' };
}
