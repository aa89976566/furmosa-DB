import {
  autoLinkedMerchantRecordIds,
  autoLinkedStoreIds,
  linkStoresAndMerchants,
  locationsDiffer,
  looksLikeDifferentBranches,
  normalizeStoreName,
  type IdentityConfidence,
  type IdentityMerchant,
  type IdentityStore,
  type StoreMerchantLink,
} from '@/lib/jar-exchange/partner-store-identity';

export type ConfidenceSplit = {
  auto: number;
  needs_review: number;
  unmatched: number;
};

export type AnonymousRef = {
  kind: 'store' | 'merchant' | 'customer' | 'merchant_user' | 'refill_order' | 'coupon';
  id: string;
};

export type AuditFinding = {
  type: string;
  confidence: IdentityConfidence;
  refs: AnonymousRef[];
};

export type PartnerStoreIdentityAuditSnapshot = {
  stores: IdentityStore[];
  merchants: IdentityMerchant[];
  merchantUsers: Array<{ id: string; merchantRecordId: string; isActive: boolean }>;
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

export type PartnerStoreIdentityAuditReport = {
  generatedAt: string;
  rules: {
    uniqueNumber: string;
    automaticSameStore: string;
    neverAutoMergeByName: true;
    humanReviewOwner: 'hq';
  };
  totals: {
    storeCount: number;
    merchantCount: number;
    autoLinkedPairs: number;
  };
  metrics: {
    duplicateStores: ConfidenceSplit & { findings: AuditFinding[] };
    redeemOnlyStores: ConfidenceSplit & { findings: AuditFinding[] };
    unmappedStoresAndMerchants: ConfidenceSplit & { findings: AuditFinding[] };
    duplicateOrUnlinkedMembers: ConfidenceSplit & { findings: AuditFinding[] };
    sameNameDifferentLocation: ConfidenceSplit & { findings: AuditFinding[] };
    ambiguousMatches: ConfidenceSplit & { findings: AuditFinding[] };
    staffOrTxnWithoutStore: ConfidenceSplit & { findings: AuditFinding[] };
  };
};

function emptySplit(): ConfidenceSplit {
  return { auto: 0, needs_review: 0, unmatched: 0 };
}

function addFinding(
  bucket: ConfidenceSplit & { findings: AuditFinding[] },
  finding: AuditFinding,
) {
  bucket[finding.confidence] += 1;
  bucket.findings.push(finding);
}

function groupByName<T extends { name: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = normalizeStoreName(row.name);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return groups;
}

function knownStoreKeys(stores: IdentityStore[]): Set<string> {
  const keys = new Set<string>();
  for (const store of stores) {
    keys.add(store.slug.trim().toLowerCase());
    keys.add(store.id.trim().toLowerCase());
  }
  return keys;
}

function countConfidence(findings: AuditFinding[]): ConfidenceSplit {
  const split = emptySplit();
  for (const finding of findings) split[finding.confidence] += 1;
  return split;
}

function withFindings(findings: AuditFinding[]) {
  return { ...countConfidence(findings), findings };
}

export function summarizePartnerStoreIdentityAudit(
  snapshot: PartnerStoreIdentityAuditSnapshot,
  now = new Date(),
): PartnerStoreIdentityAuditReport {
  const links = linkStoresAndMerchants(snapshot.stores, snapshot.merchants);
  const autoStoreIds = autoLinkedStoreIds(links);
  const autoMerchantIds = autoLinkedMerchantRecordIds(links);
  const reviewLinks = links.filter((link) => link.confidence === 'needs_review');

  const duplicateStores = collectDuplicateStores(snapshot.stores, snapshot.merchants);
  const redeemOnlyStores = collectRedeemOnly(snapshot.stores, autoStoreIds, reviewLinks);
  const unmapped = collectUnmapped(
    snapshot.stores,
    snapshot.merchants,
    autoStoreIds,
    autoMerchantIds,
    reviewLinks,
  );
  const members = collectMemberIssues(snapshot);
  const sameNameDifferentLocation = collectSameNameDifferentLocation(snapshot.merchants);
  const ambiguous = collectAmbiguousMatches(reviewLinks);
  const orphans = collectStaffOrTxnWithoutStore(snapshot, autoMerchantIds);

  return {
    generatedAt: now.toISOString(),
    rules: {
      uniqueNumber: 'Merchant.merchantId',
      automaticSameStore: 'store.slug === merchantToStoreSlug(merchant.merchantId)',
      neverAutoMergeByName: true,
      humanReviewOwner: 'hq',
    },
    totals: {
      storeCount: snapshot.stores.length,
      merchantCount: snapshot.merchants.length,
      autoLinkedPairs: links.filter((link) => link.confidence === 'auto').length,
    },
    metrics: {
      duplicateStores: withFindings(duplicateStores),
      redeemOnlyStores: withFindings(redeemOnlyStores),
      unmappedStoresAndMerchants: withFindings(unmapped),
      duplicateOrUnlinkedMembers: withFindings(members),
      sameNameDifferentLocation: withFindings(sameNameDifferentLocation),
      ambiguousMatches: withFindings(ambiguous),
      staffOrTxnWithoutStore: withFindings(orphans),
    },
  };
}

function collectDuplicateStores(
  stores: IdentityStore[],
  merchants: IdentityMerchant[],
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const [, group] of groupByName(stores)) {
    if (group.length < 2) continue;
    const branchSplit = group.some((left, index) =>
      group.slice(index + 1).some((right) => looksLikeDifferentBranches(left.name, right.name)),
    );
    findings.push({
      type: 'duplicate_store_name',
      confidence: branchSplit ? 'auto' : 'needs_review',
      refs: group.map((row) => ({ kind: 'store', id: row.slug })),
    });
  }

  for (const [, group] of groupByName(merchants)) {
    if (group.length < 2) continue;
    const differentLocation = group.some((left, index) =>
      group.slice(index + 1).some((right) => locationsDiffer(left, right)),
    );
    const branchSplit = group.some((left, index) =>
      group.slice(index + 1).some((right) => looksLikeDifferentBranches(left.name, right.name)),
    );
    findings.push({
      type: 'duplicate_merchant_name',
      confidence: differentLocation || branchSplit ? 'auto' : 'needs_review',
      refs: group.map((row) => ({ kind: 'merchant', id: row.merchantId })),
    });
  }

  return findings;
}

function collectRedeemOnly(
  stores: IdentityStore[],
  autoStoreIds: Set<string>,
  reviewLinks: StoreMerchantLink[],
): AuditFinding[] {
  const reviewByStore = new Set(reviewLinks.map((link) => link.storeId));
  return stores
    .filter((store) => !autoStoreIds.has(store.id))
    .map((store) => ({
      type: 'redeem_only_store',
      confidence: reviewByStore.has(store.id) ? 'needs_review' : 'unmatched',
      refs: [{ kind: 'store' as const, id: store.slug }],
    }));
}

function collectUnmapped(
  stores: IdentityStore[],
  merchants: IdentityMerchant[],
  autoStoreIds: Set<string>,
  autoMerchantIds: Set<string>,
  reviewLinks: StoreMerchantLink[],
): AuditFinding[] {
  const reviewStoreIds = new Set(reviewLinks.map((link) => link.storeId));
  const reviewMerchantIds = new Set(reviewLinks.map((link) => link.merchantRecordId));
  const findings: AuditFinding[] = [];

  for (const store of stores) {
    if (autoStoreIds.has(store.id)) continue;
    findings.push({
      type: 'store_without_slug_match',
      confidence: reviewStoreIds.has(store.id) ? 'needs_review' : 'unmatched',
      refs: [{ kind: 'store', id: store.slug }],
    });
  }

  for (const merchant of merchants) {
    if (autoMerchantIds.has(merchant.id)) continue;
    findings.push({
      type: 'merchant_without_slug_match',
      confidence: reviewMerchantIds.has(merchant.id) ? 'needs_review' : 'unmatched',
      refs: [{ kind: 'merchant', id: merchant.merchantId }],
    });
  }

  return findings;
}

function collectMemberIssues(snapshot: PartnerStoreIdentityAuditSnapshot): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const storeKeys = knownStoreKeys(snapshot.stores);

  const phoneGroups = new Map<string, string[]>();
  const lineGroups = new Map<string, string[]>();

  for (const customer of snapshot.customers) {
    if (customer.phoneKey) {
      const list = phoneGroups.get(customer.phoneKey) ?? [];
      list.push(customer.customerId);
      phoneGroups.set(customer.phoneKey, list);
    }
    if (customer.lineKey) {
      const list = lineGroups.get(customer.lineKey) ?? [];
      list.push(customer.customerId);
      lineGroups.set(customer.lineKey, list);
    }

    const rawKeys = [customer.signupStore, customer.storeId]
      .map((value) => value?.trim().toLowerCase() ?? '')
      .filter(Boolean);
    if (rawKeys.length === 0) {
      if (customer.hasJarActivity) {
        findings.push({
          type: 'member_jar_activity_without_store',
          confidence: 'unmatched',
          refs: [{ kind: 'customer', id: customer.customerId }],
        });
      }
      continue;
    }
    const allKnown = rawKeys.every((key) => storeKeys.has(key));
    if (!allKnown) {
      findings.push({
        type: 'member_store_not_found',
        confidence: 'unmatched',
        refs: [{ kind: 'customer', id: customer.customerId }],
      });
    }
  }

  for (const ids of phoneGroups.values()) {
    if (ids.length < 2) continue;
    findings.push({
      type: 'duplicate_member_phone',
      confidence: 'needs_review',
      refs: ids.map((id) => ({ kind: 'customer', id })),
    });
  }

  for (const ids of lineGroups.values()) {
    if (ids.length < 2) continue;
    findings.push({
      type: 'duplicate_member_line',
      confidence: 'auto',
      refs: ids.map((id) => ({ kind: 'customer', id })),
    });
  }

  return findings;
}

function collectSameNameDifferentLocation(merchants: IdentityMerchant[]): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const [, group] of groupByName(merchants)) {
    if (group.length < 2) continue;
    const pairs: IdentityMerchant[][] = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = group[i];
        const right = group[j];
        if (locationsDiffer(left, right) || looksLikeDifferentBranches(left.name, right.name)) {
          pairs.push([left, right]);
        }
      }
    }
    if (pairs.length === 0) continue;
    findings.push({
      type: 'same_name_different_location',
      confidence: 'auto',
      refs: group.map((row) => ({ kind: 'merchant', id: row.merchantId })),
    });
  }

  const byStem = new Map<string, IdentityMerchant[]>();
  for (const merchant of merchants) {
    const stem = normalizeStoreName(merchant.name).replace(
      /(中和|板橋|土城|三重|新莊|新店|汐止|淡水|林口|蘆洲|永和|大安|中山|松山|信義|士林|內湖|文山|北投|中壢|桃園|竹北|新竹|台中|臺中|台南|臺南|高雄)店?/g,
      '',
    );
    if (stem.length < 2) continue;
    const list = byStem.get(stem) ?? [];
    list.push(merchant);
    byStem.set(stem, list);
  }

  const seen = new Set(findings.flatMap((finding) => finding.refs.map((ref) => ref.id)));
  for (const group of byStem.values()) {
    if (group.length < 2) continue;
    const branchPairs = group.filter((left, index) =>
      group.slice(index + 1).some((right) => looksLikeDifferentBranches(left.name, right.name)),
    );
    if (branchPairs.length === 0) continue;
    const refs = group
      .filter((row) => group.some((other) => other !== row && looksLikeDifferentBranches(row.name, other.name)))
      .map((row) => ({ kind: 'merchant' as const, id: row.merchantId }));
    if (refs.every((ref) => seen.has(ref.id))) continue;
    findings.push({
      type: 'same_brand_different_branch',
      confidence: 'auto',
      refs,
    });
  }

  return findings;
}

function collectAmbiguousMatches(reviewLinks: StoreMerchantLink[]): AuditFinding[] {
  const byStore = new Map<string, StoreMerchantLink[]>();
  const byMerchant = new Map<string, StoreMerchantLink[]>();

  for (const link of reviewLinks) {
    const storeList = byStore.get(link.storeId) ?? [];
    storeList.push(link);
    byStore.set(link.storeId, storeList);

    const merchantList = byMerchant.get(link.merchantRecordId) ?? [];
    merchantList.push(link);
    byMerchant.set(link.merchantRecordId, merchantList);
  }

  const findings: AuditFinding[] = [];

  for (const links of byStore.values()) {
    if (links.length < 2) continue;
    findings.push({
      type: 'store_matches_multiple_merchants',
      confidence: 'needs_review',
      refs: [
        { kind: 'store', id: links[0].storeSlug },
        ...links.map((link) => ({ kind: 'merchant' as const, id: link.merchantId })),
      ],
    });
  }

  for (const links of byMerchant.values()) {
    if (links.length < 2) continue;
    findings.push({
      type: 'merchant_matches_multiple_stores',
      confidence: 'needs_review',
      refs: [
        { kind: 'merchant', id: links[0].merchantId },
        ...links.map((link) => ({ kind: 'store' as const, id: link.storeSlug })),
      ],
    });
  }

  return findings;
}

function collectStaffOrTxnWithoutStore(
  snapshot: PartnerStoreIdentityAuditSnapshot,
  autoMerchantIds: Set<string>,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const merchantsByRecordId = new Map(snapshot.merchants.map((row) => [row.id, row]));
  const storeKeys = knownStoreKeys(snapshot.stores);

  for (const user of snapshot.merchantUsers) {
    const merchant = merchantsByRecordId.get(user.merchantRecordId);
    if (!merchant) {
      findings.push({
        type: 'merchant_user_missing_merchant',
        confidence: 'unmatched',
        refs: [{ kind: 'merchant_user', id: user.id }],
      });
      continue;
    }
    if (!autoMerchantIds.has(merchant.id)) {
      findings.push({
        type: 'merchant_user_without_redeem_store',
        confidence: merchant.status === 'active' ? 'needs_review' : 'unmatched',
        refs: [
          { kind: 'merchant_user', id: user.id },
          { kind: 'merchant', id: merchant.merchantId },
        ],
      });
    }
  }

  for (const order of snapshot.refillOrders) {
    const merchant = merchantsByRecordId.get(order.merchantRecordId);
    if (!merchant) {
      findings.push({
        type: 'refill_order_missing_merchant',
        confidence: 'unmatched',
        refs: [{ kind: 'refill_order', id: order.id }],
      });
      continue;
    }
    if (!autoMerchantIds.has(merchant.id)) {
      findings.push({
        type: 'refill_order_without_redeem_store',
        confidence: 'needs_review',
        refs: [
          { kind: 'refill_order', id: order.id },
          { kind: 'merchant', id: merchant.merchantId },
        ],
      });
    }
  }

  for (const coupon of snapshot.coupons) {
    const key = coupon.storeKey.trim().toLowerCase();
    if (!key || storeKeys.has(key)) continue;
    findings.push({
      type: 'coupon_store_not_found',
      confidence: 'unmatched',
      refs: [{ kind: 'coupon', id: coupon.id }],
    });
  }

  return findings;
}

export function formatAuditReportMarkdown(report: PartnerStoreIdentityAuditReport): string {
  const lines: string[] = [
    '# 匠寵店家身分只讀檢查',
    '',
    `檢查時間：${report.generatedAt}`,
    '',
    '判定方式：只有「核銷 slug = 寄賣編號推導出的 slug」可自動視為同一家。店名不得自動合併。',
    '',
    `- 核銷店 ${report.totals.storeCount} 筆`,
    `- 寄賣店 ${report.totals.merchantCount} 筆`,
    `- 可自動對應 ${report.totals.autoLinkedPairs} 對`,
    '',
    '| 項目 | 可自動確認 | 需要人工確認 | 完全無法對應 | 合計 |',
    '|---|---:|---:|---:|---:|',
  ];

  const rows: Array<[string, ConfidenceSplit]> = [
    ['1. 重複店家', report.metrics.duplicateStores],
    ['2. 只有核銷、沒有對應寄賣', report.metrics.redeemOnlyStores],
    ['3. 核銷與寄賣無法互相對應', report.metrics.unmappedStoresAndMerchants],
    ['4. 重複會員或 LINE 無法對應', report.metrics.duplicateOrUnlinkedMembers],
    ['5. 同名但不同地址或分店', report.metrics.sameNameDifferentLocation],
    ['6. 一筆可能對到兩家店', report.metrics.ambiguousMatches],
    ['7. 有店員帳號或交易但找不到有效店家', report.metrics.staffOrTxnWithoutStore],
  ];

  for (const [label, split] of rows) {
    const total = split.auto + split.needs_review + split.unmatched;
    lines.push(
      `| ${label} | ${split.auto} | ${split.needs_review} | ${split.unmatched} | ${total} |`,
    );
  }

  lines.push('', '## 匿名編號（不含姓名、電話、LINE）', '');

  for (const [label, metric] of rows) {
    lines.push(`### ${label}`);
    if (metric.findings.length === 0) {
      lines.push('', '無', '');
      continue;
    }
    lines.push('');
    for (const finding of metric.findings) {
      const refs = finding.refs.map((ref) => `${ref.kind}:${ref.id}`).join(', ');
      lines.push(`- [${finding.confidence}] ${finding.type} — ${refs}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
