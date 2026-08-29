import {
  classifyPartnerStoreIdentity,
  identityClassLabel,
  namesLookSimilar,
  normalizeRedeemSlug,
  normalizeStoreName,
  redeemSlugFromStoreNumber,
  storeNumberFromRedeemSlug,
  canonicalStoreNumber,
  type ClassifiedMerchant,
  type ClassifiedStore,
  type IdentityClass,
  type IdentityMerchant,
  type IdentityStore,
} from '@/lib/jar-exchange/partner-store-identity';

export type ClassCount = Record<IdentityClass, number>;

export type AnonymousRef = {
  kind: 'store' | 'merchant' | 'customer' | 'merchant_user' | 'refill_order' | 'coupon';
  id: string;
};

export type AuditFinding = {
  type: string;
  class: IdentityClass;
  refs: AnonymousRef[];
};

export type ConflictSubtypeCount = {
  duplicateSlug: number;
  duplicateStoreNumber: number;
  twoNumbersOneSlug: number;
  twoSlugsOneNumber: number;
  oneToMany: number;
};

export type PartnerStoreIdentityAuditSnapshot = {
  stores: IdentityStore[];
  merchants: IdentityMerchant[];
  merchantUsers: Array<{ id: string; merchantRecordId: string }>;
  refillOrders: Array<{ id: string; merchantRecordId: string }>;
  coupons: Array<{ id: string; storeKey: string }>;
  customers: Array<{
    customerId: string;
    signupStore: string | null;
    storeId: string | null;
    phoneKey: string | null;
    lineKey: string | null;
    hasJarActivity: boolean;
  }>;
};

export type DataSourceKind =
  | 'production'
  | 'production_readonly_replica'
  | 'unavailable'
  | 'unit-test';

export type IdentityPair = {
  slug: string;
  merchantId: string;
};

export type PartnerStoreIdentityAuditReport = {
  checkedAt: string;
  environment: {
    name: string;
    dataSource: DataSourceKind;
    databaseConfigured: boolean;
    queriedLiveData: boolean;
  };
  valid: boolean;
  decisionReady: boolean;
  invalidReasons: string[];
  totals: {
    merchantMasterCount: number;
    redeemStoreCount: number;
    allRecordCount: number;
  };
  storeIdentity: {
    exclusive: boolean;
    recordsCountedInMultipleClasses: number;
    duplicateClassRefs: AnonymousRef[];
    byClass: ClassCount;
    storeByClass: ClassCount;
    merchantByClass: ClassCount;
    reconcilable: boolean;
    recordFormula: string;
    pairFormula: string;
    oneToOnePairs: IdentityPair[];
    oneToOnePairCount: number;
    oneToOneCanDivideByTwo: boolean;
    needsReviewGroupCount: number;
    conflictGroupCount: number;
    orphanMasters: number;
    orphanRedeemStores: number;
    confirmedOneToOneStores: number;
  };
  conflictSubtypes: ConflictSubtypeCount & {
    note: string;
    subtypeSum: number;
    mayExceedConflictCount: boolean;
  };
  supplementalSeven: {
    overlapping: true;
    note: string;
    items: Array<{
      key: string;
      label: string;
      findings: AuditFinding[];
      byClass: ClassCount;
    }>;
  };
  membersAndLine: {
    separateFromStoreIdentity: true;
    note: string;
    uniqueLineOneMember: number;
    duplicatePhoneGroups: number;
    duplicateLineGroups: number;
    orphanMemberRefs: number;
    findings: AuditFinding[];
  };
  classifiedStores: ClassifiedStore[];
  classifiedMerchants: ClassifiedMerchant[];
};

function emptyClassCount(): ClassCount {
  return { one_to_one: 0, needs_review: 0, conflict: 0, orphan: 0 };
}

function addClass(count: ClassCount, identityClass: IdentityClass) {
  count[identityClass] += 1;
}

function sumClassCount(count: ClassCount): number {
  return count.one_to_one + count.needs_review + count.conflict + count.orphan;
}

function countByClass<T extends { class: IdentityClass; storeId?: string; merchantRecordId?: string }>(
  rows: T[],
  idOf: (row: T) => string,
): { byClass: ClassCount; recordsCountedInMultipleClasses: number } {
  const seen = new Map<string, IdentityClass>();
  let recordsCountedInMultipleClasses = 0;
  const byClass = emptyClassCount();
  for (const row of rows) {
    const id = idOf(row);
    const previous = seen.get(id);
    if (previous && previous !== row.class) recordsCountedInMultipleClasses += 1;
    if (previous) continue;
    seen.set(id, row.class);
    addClass(byClass, row.class);
  }
  return { byClass, recordsCountedInMultipleClasses };
}

export function findRecordsInMultipleClasses(
  stores: ClassifiedStore[],
  merchants: ClassifiedMerchant[],
): AnonymousRef[] {
  const storeSeen = new Map<string, IdentityClass>();
  const merchantSeen = new Map<string, IdentityClass>();
  const dups: AnonymousRef[] = [];
  for (const row of stores) {
    const previous = storeSeen.get(row.storeId);
    if (previous && previous !== row.class) {
      dups.push({ kind: 'store', id: row.slug });
    }
    storeSeen.set(row.storeId, row.class);
  }
  for (const row of merchants) {
    const previous = merchantSeen.get(row.merchantRecordId);
    if (previous && previous !== row.class) {
      dups.push({ kind: 'merchant', id: row.merchantId });
    }
    merchantSeen.set(row.merchantRecordId, row.class);
  }
  return dups;
}

export function buildOneToOnePairs(
  stores: ClassifiedStore[],
  merchants: ClassifiedMerchant[],
): IdentityPair[] {
  const merchantsByNumber = new Map(
    merchants.filter((row) => row.class === 'one_to_one').map((row) => [row.merchantId, row]),
  );
  const pairs: IdentityPair[] = [];
  const usedMerchants = new Set<string>();
  for (const store of stores) {
    if (store.class !== 'one_to_one') continue;
    const merchantId = store.candidateIds[0];
    if (!merchantId) continue;
    const merchant = merchantsByNumber.get(merchantId);
    if (!merchant || usedMerchants.has(merchant.merchantId)) continue;
    if (!merchant.candidateIds.includes(store.slug)) continue;
    usedMerchants.add(merchant.merchantId);
    pairs.push({ slug: store.slug, merchantId: merchant.merchantId });
  }
  return pairs;
}

function countLinkedGroups(
  stores: ClassifiedStore[],
  merchants: ClassifiedMerchant[],
  identityClass: IdentityClass,
): number {
  const storeNodes = stores.filter((row) => row.class === identityClass);
  const merchantNodes = merchants.filter((row) => row.class === identityClass);
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const store of storeNodes) parent.set(`s:${store.storeId}`, `s:${store.storeId}`);
  for (const merchant of merchantNodes) {
    parent.set(`m:${merchant.merchantRecordId}`, `m:${merchant.merchantRecordId}`);
  }
  for (const store of storeNodes) {
    for (const merchantId of store.candidateIds) {
      const merchant = merchantNodes.find((row) => row.merchantId === merchantId);
      if (merchant) union(`s:${store.storeId}`, `m:${merchant.merchantRecordId}`);
    }
  }
  for (const merchant of merchantNodes) {
    for (const slug of merchant.candidateIds) {
      const store = storeNodes.find((row) => row.slug === slug);
      if (store) union(`m:${merchant.merchantRecordId}`, `s:${store.storeId}`);
    }
  }
  const sizes = new Map<string, number>();
  for (const id of parent.keys()) {
    const root = find(id);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  return [...sizes.values()].filter((size) => size >= 2).length;
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
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

function countFindings(findings: AuditFinding[]): ClassCount {
  const byClass = emptyClassCount();
  for (const finding of findings) addClass(byClass, finding.class);
  return byClass;
}

function storeKeys(stores: IdentityStore[]): Set<string> {
  const keys = new Set<string>();
  for (const store of stores) {
    keys.add(normalizeRedeemSlug(store.slug));
    keys.add(store.id.trim().toLowerCase());
  }
  return keys;
}

export function countConflictSubtypes(input: {
  stores: IdentityStore[];
  merchants: IdentityMerchant[];
}): ConflictSubtypeCount {
  const storesBySlug = groupBy(input.stores, (row) => normalizeRedeemSlug(row.slug));
  const merchantsByNumber = groupBy(input.merchants, (row) => canonicalStoreNumber(row.merchantId));
  const merchantsByDerivedSlug = groupBy(input.merchants, (row) =>
    redeemSlugFromStoreNumber(row.merchantId),
  );
  const storesByReversedNumber = groupBy(
    input.stores,
    (row) => storeNumberFromRedeemSlug(row.slug) ?? '',
  );

  let duplicateSlug = 0;
  for (const rows of storesBySlug.values()) {
    if (rows.length > 1) duplicateSlug += rows.length;
  }
  let duplicateStoreNumber = 0;
  for (const rows of merchantsByNumber.values()) {
    if (rows.length > 1) duplicateStoreNumber += rows.length;
  }
  let twoNumbersOneSlug = 0;
  for (const rows of merchantsByDerivedSlug.values()) {
    if (rows.length > 1) twoNumbersOneSlug += rows.length;
  }
  let twoSlugsOneNumber = 0;
  for (const [number, rows] of storesByReversedNumber) {
    if (!number || rows.length < 2) continue;
    twoSlugsOneNumber += rows.length;
  }

  let oneToMany = 0;
  for (const store of input.stores) {
    const reversed = storeNumberFromRedeemSlug(store.slug);
    if (!reversed) continue;
    const byNumber = merchantsByNumber.get(reversed) ?? [];
    const bySlug = merchantsByDerivedSlug.get(normalizeRedeemSlug(store.slug)) ?? [];
    if (byNumber.length > 1 || bySlug.length > 1) oneToMany += 1;
  }

  return {
    duplicateSlug,
    duplicateStoreNumber,
    twoNumbersOneSlug,
    twoSlugsOneNumber,
    oneToMany,
  };
}

function collectDuplicateNameStores(
  stores: IdentityStore[],
  merchants: IdentityMerchant[],
  classifiedStores: ClassifiedStore[],
  classifiedMerchants: ClassifiedMerchant[],
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const storeClass = new Map(classifiedStores.map((row) => [row.storeId, row.class]));
  const merchantClass = new Map(classifiedMerchants.map((row) => [row.merchantRecordId, row.class]));

  for (const [, group] of groupBy(stores, (row) => normalizeStoreName(row.name))) {
    if (group.length < 2) continue;
    findings.push({
      type: 'duplicate_store_name',
      class: group.some((row) => storeClass.get(row.id) === 'conflict') ? 'conflict' : 'needs_review',
      refs: group.map((row) => ({ kind: 'store', id: row.slug })),
    });
  }
  for (const [, group] of groupBy(merchants, (row) => normalizeStoreName(row.name))) {
    if (group.length < 2) continue;
    findings.push({
      type: 'duplicate_merchant_name',
      class: group.some((row) => merchantClass.get(row.id) === 'conflict')
        ? 'conflict'
        : 'needs_review',
      refs: group.map((row) => ({ kind: 'merchant', id: canonicalStoreNumber(row.merchantId) })),
    });
  }
  return findings;
}

function collectRedeemOnly(classifiedStores: ClassifiedStore[]): AuditFinding[] {
  return classifiedStores
    .filter((row) => row.class !== 'one_to_one')
    .map((row) => ({
      type: 'redeem_without_master',
      class: row.class,
      refs: [{ kind: 'store' as const, id: row.slug }],
    }));
}

function collectUnmapped(
  classifiedStores: ClassifiedStore[],
  classifiedMerchants: ClassifiedMerchant[],
): AuditFinding[] {
  return [
    ...classifiedStores
      .filter((row) => row.class !== 'one_to_one')
      .map((row) => ({
        type: 'store_not_one_to_one',
        class: row.class,
        refs: [{ kind: 'store' as const, id: row.slug }],
      })),
    ...classifiedMerchants
      .filter((row) => row.class !== 'one_to_one')
      .map((row) => ({
        type: 'merchant_not_one_to_one',
        class: row.class,
        refs: [{ kind: 'merchant' as const, id: row.merchantId }],
      })),
  ];
}

function collectSameNameDifferentLocation(merchants: IdentityMerchant[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const [, group] of groupBy(merchants, (row) => normalizeStoreName(row.name))) {
    if (group.length < 2) continue;
    const locations = new Set(
      group
        .map((row) => `${row.city ?? ''}${row.address ?? ''}`.replace(/\s+/g, '').toLowerCase())
        .filter(Boolean),
    );
    if (locations.size < 2) continue;
    findings.push({
      type: 'same_name_different_location',
      class: 'needs_review',
      refs: group.map((row) => ({ kind: 'merchant', id: canonicalStoreNumber(row.merchantId) })),
    });
  }
  return findings;
}

function collectAmbiguousNameMatches(
  stores: IdentityStore[],
  merchants: IdentityMerchant[],
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const store of stores) {
    const hits = merchants.filter((merchant) => namesLookSimilar(store.name, merchant.name));
    if (hits.length < 2) continue;
    findings.push({
      type: 'store_name_matches_multiple_merchants',
      class: 'needs_review',
      refs: [
        { kind: 'store', id: store.slug },
        ...hits.map((merchant) => ({
          kind: 'merchant' as const,
          id: canonicalStoreNumber(merchant.merchantId),
        })),
      ],
    });
  }
  for (const merchant of merchants) {
    const hits = stores.filter((store) => namesLookSimilar(store.name, merchant.name));
    if (hits.length < 2) continue;
    findings.push({
      type: 'merchant_name_matches_multiple_stores',
      class: 'needs_review',
      refs: [
        { kind: 'merchant', id: canonicalStoreNumber(merchant.merchantId) },
        ...hits.map((store) => ({ kind: 'store' as const, id: store.slug })),
      ],
    });
  }
  return findings;
}

function collectStaffOrTxnIssues(
  snapshot: PartnerStoreIdentityAuditSnapshot,
  classifiedMerchants: ClassifiedMerchant[],
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const merchantsByRecordId = new Map(snapshot.merchants.map((row) => [row.id, row]));
  const classByMerchantRecord = new Map(
    classifiedMerchants.map((row) => [row.merchantRecordId, row]),
  );
  const keys = storeKeys(snapshot.stores);

  for (const user of snapshot.merchantUsers) {
    const merchant = merchantsByRecordId.get(user.merchantRecordId);
    if (!merchant) {
      findings.push({
        type: 'merchant_user_missing_merchant',
        class: 'orphan',
        refs: [{ kind: 'merchant_user', id: user.id }],
      });
      continue;
    }
    const classified = classByMerchantRecord.get(merchant.id);
    if (classified?.class === 'one_to_one') {
      findings.push({
        type: 'merchant_user_on_one_to_one',
        class: 'one_to_one',
        refs: [
          { kind: 'merchant_user', id: user.id },
          { kind: 'merchant', id: classified.merchantId },
        ],
      });
      continue;
    }
    findings.push({
      type: 'merchant_user_store_pending',
      class: classified?.class ?? 'needs_review',
      refs: [
        { kind: 'merchant_user', id: user.id },
        { kind: 'merchant', id: canonicalStoreNumber(merchant.merchantId) },
      ],
    });
  }

  for (const order of snapshot.refillOrders) {
    const merchant = merchantsByRecordId.get(order.merchantRecordId);
    if (!merchant) {
      findings.push({
        type: 'refill_order_missing_merchant',
        class: 'orphan',
        refs: [{ kind: 'refill_order', id: order.id }],
      });
      continue;
    }
    const classified = classByMerchantRecord.get(merchant.id);
    if (classified?.class === 'one_to_one') continue;
    findings.push({
      type: 'refill_order_store_pending',
      class: classified?.class ?? 'needs_review',
      refs: [
        { kind: 'refill_order', id: order.id },
        { kind: 'merchant', id: canonicalStoreNumber(merchant.merchantId) },
      ],
    });
  }

  for (const coupon of snapshot.coupons) {
    const key = coupon.storeKey.trim().toLowerCase();
    if (key && keys.has(key)) continue;
    findings.push({
      type: 'coupon_store_not_found',
      class: 'orphan',
      refs: [{ kind: 'coupon', id: coupon.id }],
    });
  }

  for (const customer of snapshot.customers) {
    if (!customer.hasJarActivity) continue;
    const rawKeys = [customer.signupStore, customer.storeId]
      .map((value) => value?.trim().toLowerCase() ?? '')
      .filter(Boolean);
    if (rawKeys.length === 0 || rawKeys.some((key) => !keys.has(key))) {
      findings.push({
        type: 'jar_activity_store_not_found',
        class: 'orphan',
        refs: [{ kind: 'customer', id: customer.customerId }],
      });
    }
  }

  return findings;
}

function collectMemberFindings(snapshot: PartnerStoreIdentityAuditSnapshot): {
  uniqueLineOneMember: number;
  duplicatePhoneGroups: number;
  duplicateLineGroups: number;
  orphanMemberRefs: number;
  findings: AuditFinding[];
} {
  const findings: AuditFinding[] = [];
  const phoneGroups = groupBy(
    snapshot.customers.filter((row) => row.phoneKey),
    (row) => row.phoneKey ?? '',
  );
  const lineGroups = groupBy(
    snapshot.customers.filter((row) => row.lineKey),
    (row) => row.lineKey ?? '',
  );

  let duplicatePhoneGroups = 0;
  for (const rows of phoneGroups.values()) {
    if (rows.length < 2) continue;
    duplicatePhoneGroups += 1;
    findings.push({
      type: 'duplicate_member_phone',
      class: 'needs_review',
      refs: rows.map((row) => ({ kind: 'customer', id: row.customerId })),
    });
  }

  let duplicateLineGroups = 0;
  let uniqueLineOneMember = 0;
  for (const rows of lineGroups.values()) {
    if (rows.length === 1) {
      uniqueLineOneMember += 1;
      continue;
    }
    duplicateLineGroups += 1;
    findings.push({
      type: 'duplicate_member_line',
      class: 'conflict',
      refs: rows.map((row) => ({ kind: 'customer', id: row.customerId })),
    });
  }

  return {
    uniqueLineOneMember,
    duplicatePhoneGroups,
    duplicateLineGroups,
    orphanMemberRefs: 0,
    findings,
  };
}

export function summarizePartnerStoreIdentityAudit(
  snapshot: PartnerStoreIdentityAuditSnapshot,
  meta: {
    checkedAt?: Date;
    environmentName: string;
    dataSource: DataSourceKind;
    databaseConfigured: boolean;
    queriedLiveData: boolean;
  },
): PartnerStoreIdentityAuditReport {
  const classified = classifyPartnerStoreIdentity({
    stores: snapshot.stores,
    merchants: snapshot.merchants,
  });
  const storeCount = countByClass(classified.stores, (row) => row.storeId);
  const merchantCount = countByClass(classified.merchants, (row) => row.merchantRecordId);
  const combined: ClassCount = {
    one_to_one: storeCount.byClass.one_to_one + merchantCount.byClass.one_to_one,
    needs_review: storeCount.byClass.needs_review + merchantCount.byClass.needs_review,
    conflict: storeCount.byClass.conflict + merchantCount.byClass.conflict,
    orphan: storeCount.byClass.orphan + merchantCount.byClass.orphan,
  };
  const allRecordCount = snapshot.stores.length + snapshot.merchants.length;
  const duplicateClassRefs = findRecordsInMultipleClasses(
    classified.stores,
    classified.merchants,
  );
  const recordsCountedInMultipleClasses = duplicateClassRefs.length;
  const oneToOnePairs = buildOneToOnePairs(classified.stores, classified.merchants);
  const oneToOneRecordCount = combined.one_to_one;
  const oneToOneCanDivideByTwo =
    oneToOnePairs.length * 2 === oneToOneRecordCount &&
    storeCount.byClass.one_to_one === oneToOnePairs.length &&
    merchantCount.byClass.one_to_one === oneToOnePairs.length;
  const unpairedOneToOne =
    storeCount.byClass.one_to_one !== oneToOnePairs.length ||
    merchantCount.byClass.one_to_one !== oneToOnePairs.length;
  const invalidReasons: string[] = [];
  if (recordsCountedInMultipleClasses > 0) {
    invalidReasons.push('主分類重複：同一筆資料進入兩個主分類');
  }
  if (unpairedOneToOne) {
    invalidReasons.push('一對一資料無法配成「一筆主檔＋一筆核銷店」');
  }
  if (sumClassCount(combined) !== allRecordCount) {
    invalidReasons.push('四類資料筆數加總不等於原始資料總筆數');
  }
  const valid = invalidReasons.length === 0;
  const subtypes = countConflictSubtypes(snapshot);
  const subtypeSum =
    subtypes.duplicateSlug +
    subtypes.duplicateStoreNumber +
    subtypes.twoNumbersOneSlug +
    subtypes.twoSlugsOneNumber +
    subtypes.oneToMany;

  const seven = [
    {
      key: '1',
      label: '重複店家',
      findings: collectDuplicateNameStores(
        snapshot.stores,
        snapshot.merchants,
        classified.stores,
        classified.merchants,
      ),
    },
    {
      key: '2',
      label: '只有核銷、沒有店家主檔',
      findings: collectRedeemOnly(classified.stores),
    },
    {
      key: '3',
      label: '核銷與店家主檔無法互相對應',
      findings: collectUnmapped(classified.stores, classified.merchants),
    },
    {
      key: '5',
      label: '同名但不同地址或分店',
      findings: collectSameNameDifferentLocation(snapshot.merchants),
    },
    {
      key: '6',
      label: '一筆可能對到兩家店',
      findings: collectAmbiguousNameMatches(snapshot.stores, snapshot.merchants),
    },
    {
      key: '7',
      label: '有店員帳號、交易或換罐紀錄，但找不到有效店家',
      findings: collectStaffOrTxnIssues(snapshot, classified.merchants),
    },
  ].map((item) => ({ ...item, byClass: countFindings(item.findings) }));

  const members = collectMemberFindings(snapshot);

  return {
    checkedAt: (meta.checkedAt ?? new Date()).toISOString(),
    environment: {
      name: meta.environmentName,
      dataSource: meta.dataSource,
      databaseConfigured: meta.databaseConfigured,
      queriedLiveData: meta.queriedLiveData,
    },
    valid,
    decisionReady: valid && meta.queriedLiveData && meta.dataSource !== 'unavailable',
    invalidReasons,
    totals: {
      merchantMasterCount: snapshot.merchants.length,
      redeemStoreCount: snapshot.stores.length,
      allRecordCount,
    },
    storeIdentity: {
      exclusive: recordsCountedInMultipleClasses === 0,
      recordsCountedInMultipleClasses,
      duplicateClassRefs,
      byClass: combined,
      storeByClass: storeCount.byClass,
      merchantByClass: merchantCount.byClass,
      reconcilable: valid && sumClassCount(combined) === allRecordCount,
      recordFormula: '原始資料總筆數＝一對一資料筆數＋待確認資料筆數＋衝突資料筆數＋孤立資料筆數',
      pairFormula: '一對一門市組數＝一對一資料筆數 ÷ 2（僅當每組是一筆主檔加一筆核銷店）',
      oneToOnePairs,
      oneToOnePairCount: oneToOnePairs.length,
      oneToOneCanDivideByTwo,
      needsReviewGroupCount: countLinkedGroups(
        classified.stores,
        classified.merchants,
        'needs_review',
      ),
      conflictGroupCount: countLinkedGroups(classified.stores, classified.merchants, 'conflict'),
      orphanMasters: merchantCount.byClass.orphan,
      orphanRedeemStores: storeCount.byClass.orphan,
      confirmedOneToOneStores: oneToOnePairs.length,
    },
    conflictSubtypes: {
      ...subtypes,
      subtypeSum,
      mayExceedConflictCount: subtypeSum > combined.conflict,
      note: '一筆衝突店家可能同時符合多種原因，分項合計可以大於衝突數。',
    },
    supplementalSeven: {
      overlapping: true,
      note: '這七項（會員／LINE 已獨立）可與主分類重複，不列入四類對帳。',
      items: seven,
    },
    membersAndLine: {
      separateFromStoreIdentity: true,
      note: '會員／LINE 不混入店家身分四類。',
      ...members,
    },
    classifiedStores: classified.stores,
    classifiedMerchants: classified.merchants,
  };
}

function classLine(count: ClassCount): string {
  return `${identityClassLabel.one_to_one} ${count.one_to_one}、${identityClassLabel.needs_review} ${count.needs_review}、${identityClassLabel.conflict} ${count.conflict}、${identityClassLabel.orphan} ${count.orphan}`;
}

function dataSourceLabel(source: DataSourceKind): string {
  if (source === 'production') return '正式庫';
  if (source === 'production_readonly_replica') return '正式唯讀副本';
  if (source === 'unit-test') return '單元測試資料';
  return '無法使用正式連線';
}

export function formatAuditReportMarkdown(report: PartnerStoreIdentityAuditReport): string {
  const header = [
    '# 店家身分只讀統計',
    '',
    `檢查時間／資料快照：${report.checkedAt}`,
    `檢查環境：${report.environment.name}`,
    `資料來源：${dataSourceLabel(report.environment.dataSource)}`,
    `是否查到正式資料：${report.environment.queriedLiveData ? '是' : '否'}`,
    '',
    '判定層只分類，不執行。待確認的「禁止新增功能」只是原因文字，尚未接入開通流程。',
    '',
  ];

  if (!report.valid) {
    return [
      ...header,
      '**報告無效，不輸出可供決策的正式數字。**',
      '',
      ...report.invalidReasons.map((reason) => `- ${reason}`),
      '',
      report.storeIdentity.duplicateClassRefs.length > 0
        ? `主分類重複的匿名編號：${report.storeIdentity.duplicateClassRefs
            .map((ref) => `${ref.kind}:${ref.id}`)
            .join(', ')}`
        : '',
      '',
    ]
      .filter((line, index, rows) => line !== '' || rows[index - 1] !== '')
      .join('\n')
      .concat('\n');
  }

  if (!report.environment.queriedLiveData) {
    return [
      ...header,
      '**尚未查到正式資料，不輸出可供決策的正式數字。**',
      '',
      '對帳規則已就緒，但 0 筆不代表正式庫是空的。',
      '',
    ].join('\n').concat('\n');
  }

  const { storeIdentity: identity } = report;
  const lines = [
    ...header,
    `報告是否完整通過對帳：${report.decisionReady ? '是，可供判斷' : '對帳通過，但不是正式決策數字'}`,
    '',
    '## 原始資料（筆）',
    '',
    `- 店家主檔：${report.totals.merchantMasterCount} 筆`,
    `- 舊核銷店：${report.totals.redeemStoreCount} 筆`,
    `- 原始資料總筆數：${report.totals.allRecordCount} 筆`,
    '',
    '## 四類資料筆數（互斥）',
    '',
    `- 一對一資料：${identity.byClass.one_to_one} 筆`,
    `- 待確認資料：${identity.byClass.needs_review} 筆`,
    `- 衝突資料：${identity.byClass.conflict} 筆`,
    `- 孤立資料：${identity.byClass.orphan} 筆`,
    `- 公式：${identity.recordFormula}`,
    `- 對得上：${identity.reconcilable ? '是' : '否'}`,
    `- 主分類重複：${identity.recordsCountedInMultipleClasses}（必須為 0）`,
    '',
    '## 對應關係（組）',
    '',
    `- 一對一：${identity.oneToOnePairCount} 組`,
    `- 待確認：${identity.needsReviewGroupCount} 組`,
    `- 衝突：${identity.conflictGroupCount} 組`,
    `- ${identity.pairFormula}`,
    `- 可除以二：${identity.oneToOneCanDivideByTwo ? '是' : '否'}`,
    '',
    '## 單獨資料（筆）',
    '',
    `- 孤立主檔：${identity.orphanMasters} 筆`,
    `- 孤立核銷店：${identity.orphanRedeemStores} 筆`,
    '',
    '## 已確認一對一門市',
    '',
    `- 已確認一對一門市：${identity.confirmedOneToOneStores} 間（可直接確認）`,
    `- 待確認門市關係：${identity.needsReviewGroupCount} 組（尚需總部判斷）`,
    `- 衝突關係：${identity.conflictGroupCount} 組（資料結構互相打架）`,
    '- 實際合作門市總數：暫時未知',
    '',
    '## 衝突原因分項（可重複計數）',
    '',
    report.conflictSubtypes.note,
    '',
    `- slug 重複：${report.conflictSubtypes.duplicateSlug}`,
    `- 編號重複：${report.conflictSubtypes.duplicateStoreNumber}`,
    `- 兩個編號對同一 slug：${report.conflictSubtypes.twoNumbersOneSlug}`,
    `- 兩個 slug 對同一編號：${report.conflictSubtypes.twoSlugsOneNumber}`,
    `- 一對多／多對一：${report.conflictSubtypes.oneToMany}`,
    `- 分項合計：${report.conflictSubtypes.subtypeSum}${report.conflictSubtypes.mayExceedConflictCount ? '（大於衝突資料筆數，已標示）' : ''}`,
    '',
    '## 七項補充（可重複計數，不列入對帳）',
    '',
    report.supplementalSeven.note,
    '',
  ];

  for (const item of report.supplementalSeven.items) {
    const total = sumClassCount(item.byClass);
    lines.push(
      `### ${item.key}. ${item.label}（${total}）`,
      '',
      classLine(item.byClass),
      '',
    );
    if (item.findings.length === 0) {
      lines.push('無', '');
      continue;
    }
    for (const finding of item.findings) {
      const refs = finding.refs.map((ref) => `${ref.kind}:${ref.id}`).join(', ');
      lines.push(`- [${identityClassLabel[finding.class]}] ${finding.type} — ${refs}`);
    }
    lines.push('');
  }

  lines.push(
    '## 會員／LINE（獨立，不混入店家四類）',
    '',
    report.membersAndLine.note,
    '',
    `- 一個 LINE 只對一位會員：${report.membersAndLine.uniqueLineOneMember}`,
    `- 同一電話多位會員：${report.membersAndLine.duplicatePhoneGroups}`,
    `- 同一 LINE 多位會員：${report.membersAndLine.duplicateLineGroups}`,
    `- 指向不存在會員：${report.membersAndLine.orphanMemberRefs}`,
    '',
  );

  if (report.membersAndLine.findings.length === 0) {
    lines.push('無重複電話或 LINE', '');
  } else {
    for (const finding of report.membersAndLine.findings) {
      const refs = finding.refs.map((ref) => `${ref.kind}:${ref.id}`).join(', ');
      lines.push(`- [${identityClassLabel[finding.class]}] ${finding.type} — ${refs}`);
    }
    lines.push('');
  }

  lines.push('報告不含會員姓名、電話或 LINE 內容。');
  return `${lines.join('\n')}\n`;
}
