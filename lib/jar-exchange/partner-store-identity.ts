import type { MerchantType } from '@/lib/merchant-types';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

/**
 * 店家身分判定層。
 * 只回傳分類、原因與候選關係。
 * 不發號、不切換合作功能、不改店家或 slug、不保存人工確認。
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
  types: MerchantType[];
};

export const HUMAN_DECISION_REQUIRED_FIELDS = [
  'decidedBy',
  'decidedAt',
  'rationale',
  'keptMerchantId',
  'otherRecordId',
  'otherRecordDisposition',
] as const;

export type HumanDecisionRequiredField = (typeof HUMAN_DECISION_REQUIRED_FIELDS)[number];

export const OTHER_RECORD_DISPOSITIONS = [
  'merge_into_kept',
  'mark_as_branch',
  'retire_and_keep_number',
] as const;

export type OtherRecordDisposition = (typeof OTHER_RECORD_DISPOSITIONS)[number];

export const PENDING_NO_NEW_FEATURES_REASON =
  '待確認期間不得新增功能、改變連結或合併資料；既有服務維持。此限制尚未接入開通流程。';

const MER_SLUG_RE = /^mer_(\d+)$/;
const LEGAL_SUFFIX_RE = /股份有限公司|有限公司|工作室/g;
const NOISE_RE = /[()（）\[\]【】]|核銷/g;

export function canonicalStoreNumber(merchantId: string): string {
  return merchantId.trim().toUpperCase();
}

export function redeemSlugFromStoreNumber(merchantId: string): string {
  return merchantToStoreSlug(merchantId);
}

/** 只有 mer_數字 才能讀成 MER-數字。這是對應線索，不是發號。 */
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

/** 換罐不是寄賣。判定層不改 types，只讀既有值。 */
export function typesImplyConsignment(types: MerchantType[]): boolean {
  return types.includes('consignment');
}

export function pendingRestriction(identityClass: IdentityClass): {
  blocksNewFeatures: boolean;
  wiredToOnboarding: false;
  reason: string;
} {
  if (identityClass === 'needs_review' || identityClass === 'conflict') {
    return {
      blocksNewFeatures: true,
      wiredToOnboarding: false,
      reason: PENDING_NO_NEW_FEATURES_REASON,
    };
  }
  return {
    blocksNewFeatures: false,
    wiredToOnboarding: false,
    reason: '不是待確認或衝突，判定層不提出新增功能限制',
  };
}

export function missingHumanDecisionFields(
  input: Partial<Record<HumanDecisionRequiredField, string | undefined>>,
): HumanDecisionRequiredField[] {
  return HUMAN_DECISION_REQUIRED_FIELDS.filter((field) => {
    const value = input[field];
    if (field === 'otherRecordDisposition') {
      return !OTHER_RECORD_DISPOSITIONS.includes(value as OtherRecordDisposition);
    }
    return typeof value !== 'string' || value.trim() === '';
  });
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
  const storesByReversedNumber = groupKeys(
    input.stores,
    (row) => storeNumberFromRedeemSlug(row.slug) ?? '',
  );

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
            'slug 轉出的編號不存在，但店名有候選門市，待總部確認，不自行換號',
            canonicalStoreNumber(merchant.merchantId),
          );
          addReason(
            merchantState,
            merchant.id,
            'needs_review',
            '店名相似，待總部確認，不自行換號',
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
        addReason(
          storeState,
          store.id,
          'one_to_one',
          '編號與 slug 唯一對應',
          canonicalStoreNumber(merchant.merchantId),
        );
        addReason(merchantState, merchant.id, 'one_to_one', '編號與 slug 唯一對應', store.slug);
      }
      continue;
    }

    if (!reversed) {
      const nameHits = input.merchants.filter((merchant) => namesLookSimilar(store.name, merchant.name));
      if (nameHits.length > 0) {
        for (const merchant of nameHits) {
          addReason(
            storeState,
            store.id,
            'needs_review',
            '店名、地址或分店相似，待總部確認，不自行換號',
            canonicalStoreNumber(merchant.merchantId),
          );
          addReason(
            merchantState,
            merchant.id,
            'needs_review',
            '店名、地址或分店相似，待總部確認，不自行換號',
            store.slug,
          );
        }
      } else {
        addReason(storeState, store.id, 'needs_review', '自訂 slug 轉不回門市編號，待總部確認');
      }
    }
  }

  for (const merchant of input.merchants) {
    if (merchantState.has(merchant.id)) continue;
    const nameHits = input.stores.filter((store) => namesLookSimilar(store.name, merchant.name));
    if (nameHits.length > 0) {
      for (const store of nameHits) {
        addReason(
          merchantState,
          merchant.id,
          'needs_review',
          '店名、地址或分店相似，待總部確認，不自行換號',
          store.slug,
        );
        addReason(
          storeState,
          store.id,
          'needs_review',
          '店名、地址或分店相似，待總部確認，不自行換號',
          canonicalStoreNumber(merchant.merchantId),
        );
      }
      continue;
    }
    addReason(merchantState, merchant.id, 'needs_review', '店家主檔尚無安全核銷連結，待總部確認');
  }

  for (const store of input.stores) {
    if (!storeState.has(store.id)) {
      addReason(storeState, store.id, 'needs_review', '無法安全對應，待總部確認');
    }
  }

  return {
    stores: input.stores.map((store) => ({
      storeId: store.id,
      slug: store.slug,
      ...(storeState.get(store.id) ?? {
        class: 'needs_review',
        reasons: ['無法安全對應'],
        candidateIds: [],
      }),
    })),
    merchants: input.merchants.map((merchant) => ({
      merchantRecordId: merchant.id,
      merchantId: canonicalStoreNumber(merchant.merchantId),
      types: [...merchant.types],
      ...(merchantState.get(merchant.id) ?? {
        class: 'needs_review',
        reasons: ['無法安全對應'],
        candidateIds: [],
      }),
    })),
  };
}
