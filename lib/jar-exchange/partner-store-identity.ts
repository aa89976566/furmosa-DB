import type { MerchantType } from '@/lib/merchant-types';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

/**
 * 店家身分判定（不連資料庫、不寫入、不合併）。
 * 依據：docs/PARTNER-STORE-IDENTITY.md（2026-08-29 鎖定）
 */

export const IDENTITY_CLASSES = ['one_to_one', 'needs_review', 'conflict', 'orphan'] as const;
export type IdentityClass = (typeof IDENTITY_CLASSES)[number];

export const identityClassLabel: Record<IdentityClass, string> = {
  one_to_one: '一對一',
  needs_review: '待確認',
  conflict: '衝突',
  orphan: '孤立',
};

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
  types: MerchantType[];
};

export type ClassifiedRecord = {
  class: IdentityClass;
  reasons: string[];
  candidateIds: string[];
};

export type ClassifiedStore = ClassifiedRecord & {
  storeId: string;
  slug: string;
};

export type ClassifiedMerchant = ClassifiedRecord & {
  merchantRecordId: string;
  merchantId: string;
};

export type OtherRecordDisposition = 'merge_into_kept' | 'mark_as_branch' | 'retire_and_keep_number';

export type HumanIdentityDecision = {
  decidedBy: string;
  decidedAt: string;
  rationale: string;
  keptMerchantId: string;
  otherRecordId: string;
  otherRecordDisposition: OtherRecordDisposition;
};

const MER_SLUG_RE = /^mer_(\d+)$/;
const LEGAL_SUFFIX_RE = /股份有限公司|有限公司|工作室/g;
const NOISE_RE = /[()（）\[\]【】]|核銷/g;

export function canonicalStoreNumber(merchantId: string): string {
  return merchantId.trim().toUpperCase();
}

export function redeemSlugFromStoreNumber(merchantId: string): string {
  return merchantToStoreSlug(merchantId);
}

/** 只有 mer_數字 才能轉回 MER-數字。自訂 slug 不轉。 */
export function storeNumberFromRedeemSlug(slug: string): string | null {
  const match = slug.trim().toLowerCase().match(MER_SLUG_RE);
  if (!match) return null;
  return `MER-${match[1]}`;
}

export function normalizeRedeemSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function normalizeStoreName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(NOISE_RE, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/[\s\u3000_\-－—·・]+/g, '')
    .toLowerCase();
}

export function namesLookSimilar(a: string, b: string): boolean {
  const left = normalizeStoreName(a);
  const right = normalizeStoreName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 4 && longer.includes(shorter);
}

export function nextStoreNumber(existingNumbers: string[], retiredNumbers: string[] = []): string {
  const taken = new Set(
    [...existingNumbers, ...retiredNumbers].map((value) => canonicalStoreNumber(value)),
  );
  let seq = 1;
  for (const value of taken) {
    const match = value.match(/^MER-(\d+)$/);
    if (match) seq = Math.max(seq, Number(match[1]) + 1);
  }
  let candidate = `MER-${String(seq).padStart(4, '0')}`;
  while (taken.has(candidate)) {
    seq += 1;
    candidate = `MER-${String(seq).padStart(4, '0')}`;
  }
  return candidate;
}

/** 發號：只寫請求的合作功能，不會自動加上寄賣。 */
export function issueStoreNumber(input: {
  requestedTypes: MerchantType[];
  existingNumbers: string[];
  retiredNumbers?: string[];
}): { merchantId: string; types: MerchantType[] } {
  const types = [...new Set(input.requestedTypes)];
  if (types.length === 0) {
    throw new Error('請至少選擇一種合作功能');
  }
  return {
    merchantId: nextStoreNumber(input.existingNumbers, input.retiredNumbers ?? []),
    types,
  };
}

export function hasConsignment(types: MerchantType[]): boolean {
  return types.includes('consignment');
}

export type SiteEvent = 'new_branch' | 'relocate' | 'rename' | 'retire';

export function resolveNumberForSiteEvent(input: {
  event: SiteEvent;
  existingMerchantId?: string;
  existingNumbers: string[];
  retiredNumbers?: string[];
}): { merchantId: string; action: 'issue_new' | 'keep' | 'retire' } {
  const retired = input.retiredNumbers ?? [];
  if (input.event === 'new_branch') {
    return {
      merchantId: nextStoreNumber(input.existingNumbers, retired),
      action: 'issue_new',
    };
  }
  const existing = input.existingMerchantId?.trim();
  if (!existing) {
    throw new Error('搬家、改名或停用必須沿用既有門市編號，不得另開新店');
  }
  const merchantId = canonicalStoreNumber(existing);
  if (input.event === 'retire') {
    return { merchantId, action: 'retire' };
  }
  return { merchantId, action: 'keep' };
}

export function canReissueStoreNumber(
  merchantId: string,
  retiredNumbers: string[],
): boolean {
  return !retiredNumbers.map(canonicalStoreNumber).includes(canonicalStoreNumber(merchantId));
}

export function evaluateCooperationChange(input: {
  identityClass: IdentityClass;
  currentTypes: MerchantType[];
  requestedTypes: MerchantType[];
}): { allowed: boolean; preservedTypes: MerchantType[]; reason: string } {
  const current = [...input.currentTypes].sort();
  const requested = [...new Set(input.requestedTypes)].sort();
  const same =
    current.length === requested.length && current.every((type, index) => type === requested[index]);

  if (input.identityClass === 'one_to_one') {
    return { allowed: true, preservedTypes: requested, reason: '一對一門市可以調整合作功能' };
  }

  if (same) {
    return {
      allowed: true,
      preservedTypes: input.currentTypes,
      reason: '待確認或衝突期間維持既有服務，不改變合作功能',
    };
  }

  return {
    allowed: false,
    preservedTypes: input.currentTypes,
    reason: '待確認或衝突期間不得新增功能、改變連結或合併資料；既有服務維持',
  };
}

export function recordHumanIdentityDecision(input: {
  decidedBy: string;
  decidedAt?: Date;
  rationale: string;
  keptMerchantId: string;
  otherRecordId: string;
  otherRecordDisposition: OtherRecordDisposition;
}): HumanIdentityDecision {
  const decidedBy = input.decidedBy.trim();
  const rationale = input.rationale.trim();
  const keptMerchantId = canonicalStoreNumber(input.keptMerchantId);
  const otherRecordId = input.otherRecordId.trim();
  if (!decidedBy) throw new Error('人工確認必須記錄確認人');
  if (!rationale) throw new Error('人工確認必須記錄判定依據');
  if (!keptMerchantId) throw new Error('人工確認必須記錄保留編號');
  if (!otherRecordId) throw new Error('人工確認必須記錄另一筆資料');
  if (!input.otherRecordDisposition) throw new Error('人工確認必須記錄另一筆資料的處理方式');

  return {
    decidedBy,
    decidedAt: (input.decidedAt ?? new Date()).toISOString(),
    rationale,
    keptMerchantId,
    otherRecordId,
    otherRecordDisposition: input.otherRecordDisposition,
  };
}

function addReason(
  target: Map<string, ClassifiedRecord>,
  key: string,
  identityClass: IdentityClass,
  reason: string,
  candidate?: string,
) {
  const current = target.get(key);
  if (!current) {
    target.set(key, {
      class: identityClass,
      reasons: [reason],
      candidateIds: candidate ? [candidate] : [],
    });
    return;
  }
  current.reasons.push(reason);
  if (candidate && !current.candidateIds.includes(candidate)) current.candidateIds.push(candidate);
  current.class = raiseClass(current.class, identityClass);
}

function raiseClass(current: IdentityClass, incoming: IdentityClass): IdentityClass {
  const rank: Record<IdentityClass, number> = {
    one_to_one: 0,
    needs_review: 1,
    orphan: 2,
    conflict: 3,
  };
  return rank[incoming] >= rank[current] ? incoming : current;
}

function groupKeys<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return groups;
}

export function classifyPartnerStoreIdentity(input: {
  stores: IdentityStore[];
  merchants: IdentityMerchant[];
}): { stores: ClassifiedStore[]; merchants: ClassifiedMerchant[] } {
  const storeState = new Map<string, ClassifiedRecord>();
  const merchantState = new Map<string, ClassifiedRecord>();

  const storesBySlug = groupKeys(input.stores, (row) => normalizeRedeemSlug(row.slug));
  const merchantsByNumber = groupKeys(input.merchants, (row) => canonicalStoreNumber(row.merchantId));
  const merchantsByDerivedSlug = groupKeys(input.merchants, (row) =>
    redeemSlugFromStoreNumber(row.merchantId),
  );
  const storesByReversedNumber = groupKeys(input.stores, (row) => storeNumberFromRedeemSlug(row.slug) ?? '');

  for (const [slug, rows] of storesBySlug) {
    if (rows.length < 2) continue;
    for (const row of rows) {
      addReason(storeState, row.id, 'conflict', `slug 重複使用：${slug}`);
    }
  }

  for (const [merchantId, rows] of merchantsByNumber) {
    if (rows.length < 2) continue;
    for (const row of rows) {
      addReason(merchantState, row.id, 'conflict', `門市編號重複使用：${merchantId}`);
    }
  }

  for (const [slug, rows] of merchantsByDerivedSlug) {
    if (rows.length < 2) continue;
    for (const row of rows) {
      addReason(
        merchantState,
        row.id,
        'conflict',
        `兩個編號對到同一個 slug：${slug}`,
        rows.map((item) => canonicalStoreNumber(item.merchantId)).join(','),
      );
    }
  }

  for (const [merchantId, rows] of storesByReversedNumber) {
    if (!merchantId || rows.length < 2) continue;
    for (const row of rows) {
      addReason(storeState, row.id, 'conflict', `兩個 slug 對到同一個編號：${merchantId}`);
    }
  }

  for (const store of input.stores) {
    const slug = normalizeRedeemSlug(store.slug);
    const reversed = storeNumberFromRedeemSlug(store.slug);
    const merchantsForSlug = merchantsByDerivedSlug.get(slug) ?? [];
    const merchantsForNumber = reversed ? (merchantsByNumber.get(reversed) ?? []) : [];

    if (reversed && merchantsForNumber.length === 0 && merchantsForSlug.length === 0) {
      const nameHits = input.merchants.filter((merchant) => namesLookSimilar(store.name, merchant.name));
      if (nameHits.length > 0) {
        for (const merchant of nameHits) {
          addReason(
            storeState,
            store.id,
            'needs_review',
            'slug 轉出的編號不存在，但店名有候選門市',
            canonicalStoreNumber(merchant.merchantId),
          );
          addReason(
            merchantState,
            merchant.id,
            'needs_review',
            '店名與一筆找不到編號的核銷店相似，不得自動合併',
            store.slug,
          );
        }
      } else {
        addReason(storeState, store.id, 'orphan', `slug 指向不存在的門市編號：${reversed}`);
      }
      continue;
    }

    if (reversed && (merchantsForNumber.length > 1 || merchantsForSlug.length > 1)) {
      addReason(storeState, store.id, 'conflict', '編號與 slug 不是唯一對應');
      for (const merchant of [...merchantsForNumber, ...merchantsForSlug]) {
        addReason(merchantState, merchant.id, 'conflict', '一對多或多對一', store.slug);
      }
      continue;
    }

    const matched =
      reversed &&
      merchantsForNumber.length === 1 &&
      merchantsForSlug.length === 1 &&
      merchantsForNumber[0].id === merchantsForSlug[0].id &&
      canonicalStoreNumber(merchantsForNumber[0].merchantId) === reversed;

    if (matched) {
      const merchant = merchantsForNumber[0];
      const currentStore = storeState.get(store.id);
      const currentMerchant = merchantState.get(merchant.id);
      if (currentStore?.class === 'conflict' || currentMerchant?.class === 'conflict') {
        addReason(storeState, store.id, 'conflict', '對應關係有衝突，不能算一對一');
        addReason(merchantState, merchant.id, 'conflict', '對應關係有衝突，不能算一對一', store.slug);
      } else {
        addReason(storeState, store.id, 'one_to_one', '編號與 slug 唯一對應', canonicalStoreNumber(merchant.merchantId));
        addReason(merchantState, merchant.id, 'one_to_one', '編號與 slug 唯一對應', store.slug);
      }
      continue;
    }

    if (!reversed) {
      const nameHits = input.merchants.filter((merchant) => namesLookSimilar(store.name, merchant.name));
      if (nameHits.length > 0) {
        for (const merchant of nameHits) {
          addReason(storeState, store.id, 'needs_review', '自訂 slug 或店名相似，不得自動合併', canonicalStoreNumber(merchant.merchantId));
          addReason(merchantState, merchant.id, 'needs_review', '店名相似，不得自動合併', store.slug);
        }
      } else {
        addReason(storeState, store.id, 'needs_review', '自訂 slug 轉不回門市編號，需總部確認');
      }
    }
  }

  for (const merchant of input.merchants) {
    if (merchantState.has(merchant.id)) continue;
    const nameHits = input.stores.filter((store) => namesLookSimilar(store.name, merchant.name));
    if (nameHits.length > 0) {
      for (const store of nameHits) {
        addReason(merchantState, merchant.id, 'needs_review', '店名或地址相似，不得自動合併', store.slug);
        addReason(storeState, store.id, 'needs_review', '店名或地址相似，不得自動合併', canonicalStoreNumber(merchant.merchantId));
      }
      continue;
    }
    addReason(merchantState, merchant.id, 'needs_review', '店家主檔尚無安全核銷連結，需總部確認');
  }

  for (const store of input.stores) {
    if (!storeState.has(store.id)) {
      addReason(storeState, store.id, 'needs_review', '無法安全對應，需總部確認');
    }
  }

  return {
    stores: input.stores.map((store) => ({
      storeId: store.id,
      slug: store.slug,
      ...(storeState.get(store.id) ?? { class: 'needs_review', reasons: ['無法安全對應'], candidateIds: [] }),
    })),
    merchants: input.merchants.map((merchant) => ({
      merchantRecordId: merchant.id,
      merchantId: canonicalStoreNumber(merchant.merchantId),
      ...(merchantState.get(merchant.id) ?? {
        class: 'needs_review',
        reasons: ['無法安全對應'],
        candidateIds: [],
      }),
    })),
  };
}
