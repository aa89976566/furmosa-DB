import type { JarExchangeMerchantRow } from '@/lib/jar-exchange/partner-merchants';
import {
  activeSameStoreDecisionForSlug,
  confirmedMerchantIdForSlug,
  confirmedSlugForMerchantId,
  isOfficialExcludedMerchantId,
  isOfficialExcludedStoreSlug,
  listOfficialOneToOnePairs,
  type PartnerStoreHumanDecision,
} from '@/lib/jar-exchange/partner-store-identity-decisions';
import { getGroomingCouponDiscountForStore } from '@/lib/coupons/store-discount';
import type { MerchantType } from '@/lib/merchant-types';
import type { PartnerStoreView } from '@/lib/stores/partner-stores';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

export type PartnerStoreIdentityNote = 'needs_review' | null;

export type PartnerStoreDirectoryRow = {
  key: string;
  slug: string;
  name: string;
  merchantName: string | null;
  namesDiffer: boolean;
  city: string | null;
  types: MerchantType[];
  canRedeem: boolean;
  hasJarExchangeMerchant: boolean;
  groomingDiscountAmount: number;
  merchantRecordId: string | null;
  merchantId: string | null;
  identityNote: PartnerStoreIdentityNote;
  confirmation: PartnerStoreRowConfirmation | null;
};

export type PartnerStoreRowConfirmation = {
  decisionId: string;
  decidedByAccount: string;
  decidedAt: string;
};

export type PartnerStoreDirectoryStats = {
  total: number;
  redeemableCount: number;
  jarExchangeCount: number;
  officialOneToOneCount: number;
  needsReviewCount: number;
};

export type PartnerStoreSourceKind = 'both' | 'redeem_only' | 'backend_only';

export const partnerStoreSourceLabel: Record<PartnerStoreSourceKind, string> = {
  both: '核銷＋後台',
  redeem_only: '僅核銷清單',
  backend_only: '僅換罐後台',
};

export function partnerStoreSourceKind(
  row: Pick<PartnerStoreDirectoryRow, 'canRedeem' | 'hasJarExchangeMerchant'>,
): PartnerStoreSourceKind {
  if (row.canRedeem && row.hasJarExchangeMerchant) return 'both';
  if (row.canRedeem) return 'redeem_only';
  return 'backend_only';
}

export type PartnerStoreStatusTone = 'ok' | 'gap' | 'blocked';

/** 一顆狀態：完整店家只標「可核銷」，單邊資料才補說明 */
export function partnerStoreStatusCopy(
  row: Pick<PartnerStoreDirectoryRow, 'canRedeem' | 'hasJarExchangeMerchant' | 'identityNote'>,
): { label: string; tone: PartnerStoreStatusTone } {
  const kind = partnerStoreSourceKind(row);
  if (kind === 'both') return { label: '可核銷', tone: 'ok' };
  if (row.identityNote === 'needs_review' || kind === 'redeem_only') {
    return { label: '可核銷 · 待確認', tone: 'gap' };
  }
  return { label: '未開放核銷', tone: 'blocked' };
}

/** 清單上只在有缺口時寫例外，完整店家不重複寫「可核銷」 */
export function partnerStoreExceptionLabel(
  row: Pick<PartnerStoreDirectoryRow, 'canRedeem' | 'hasJarExchangeMerchant' | 'identityNote'>,
): string | null {
  if (row.identityNote === 'needs_review') return '待確認';
  const kind = partnerStoreSourceKind(row);
  if (kind === 'redeem_only') return '待確認';
  if (kind === 'backend_only') return '未開放核銷';
  return null;
}

export function partnerStoreNeedsIdentityNote(
  row: Pick<PartnerStoreDirectoryRow, 'canRedeem' | 'hasJarExchangeMerchant' | 'namesDiffer'>,
): boolean {
  return partnerStoreSourceKind(row) !== 'both' || row.namesDiffer;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function namesDiffer(storeName: string, merchantName: string): boolean {
  const a = normalizeName(storeName);
  const b = normalizeName(merchantName);
  return a.length > 0 && b.length > 0 && a !== b;
}

function compareDirectoryRows(a: PartnerStoreDirectoryRow, b: PartnerStoreDirectoryRow): number {
  const byName = a.name.localeCompare(b.name, 'zh-Hant');
  if (byName !== 0) return byName;
  return a.slug.localeCompare(b.slug, 'en');
}

function attachMerchant(
  row: PartnerStoreDirectoryRow,
  merchant: JarExchangeMerchantRow,
): PartnerStoreDirectoryRow {
  return {
    ...row,
    merchantName: merchant.name,
    namesDiffer: namesDiffer(row.name, merchant.name),
    city: merchant.city,
    types: merchant.types,
    hasJarExchangeMerchant: true,
    merchantRecordId: merchant.id,
    merchantId: merchant.merchantId,
    identityNote: null,
    confirmation: row.confirmation,
  };
}

function rowConfirmation(
  slug: string,
  decisions: PartnerStoreHumanDecision[],
): PartnerStoreRowConfirmation | null {
  const decision = activeSameStoreDecisionForSlug(slug, decisions);
  if (!decision) return null;
  return {
    decisionId: decision.id,
    decidedByAccount: decision.decidedByAccount,
    decidedAt: decision.decidedAt,
  };
}

/** 以 slug、總部確認對應合成清單。測試／示範店不進正式合作清單。 */
export function mergePartnerStoreDirectory(
  input: {
    stores: PartnerStoreView[];
    merchants: JarExchangeMerchantRow[];
  },
  decisions: PartnerStoreHumanDecision[] = [],
): PartnerStoreDirectoryRow[] {
  const rows = new Map<string, PartnerStoreDirectoryRow>();

  for (const store of input.stores) {
    const slug = store.slug.trim();
    if (!slug || isOfficialExcludedStoreSlug(slug, decisions)) continue;
    const confirmedMerchantId = confirmedMerchantIdForSlug(slug, decisions);
    rows.set(slug, {
      key: slug,
      slug,
      name: store.name,
      merchantName: null,
      namesDiffer: false,
      city: null,
      types: [],
      canRedeem: true,
      hasJarExchangeMerchant: false,
      groomingDiscountAmount: store.groomingDiscountAmount,
      merchantRecordId: null,
      merchantId: confirmedMerchantId,
      identityNote: confirmedMerchantId ? null : 'needs_review',
      confirmation: rowConfirmation(slug, decisions),
    });
  }

  for (const merchant of input.merchants) {
    if (isOfficialExcludedMerchantId(merchant.merchantId, decisions)) continue;
    const confirmedSlug = confirmedSlugForMerchantId(merchant.merchantId, decisions);
    const derivedSlug = merchantToStoreSlug(merchant.merchantId);
    const existing = (confirmedSlug && rows.get(confirmedSlug)) || rows.get(derivedSlug);
    if (existing) {
      if (existing.hasJarExchangeMerchant) continue;
      rows.set(existing.slug, attachMerchant(existing, merchant));
      continue;
    }

    rows.set(derivedSlug, {
      key: derivedSlug,
      slug: derivedSlug,
      name: merchant.name,
      merchantName: merchant.name,
      namesDiffer: false,
      city: merchant.city,
      types: merchant.types,
      canRedeem: false,
      hasJarExchangeMerchant: true,
      groomingDiscountAmount: getGroomingCouponDiscountForStore(derivedSlug, merchant.name),
      merchantRecordId: merchant.id,
      merchantId: merchant.merchantId,
      identityNote: null,
      confirmation: null,
    });
  }

  for (const row of rows.values()) {
    if (row.canRedeem && !row.hasJarExchangeMerchant) {
      row.identityNote = 'needs_review';
    }
  }

  return [...rows.values()].sort(compareDirectoryRows);
}

export function partnerStoreDirectoryStats(
  rows: PartnerStoreDirectoryRow[],
  input?: {
    storeSlugs: string[];
    merchantIds: string[];
    decisions?: PartnerStoreHumanDecision[];
  },
): PartnerStoreDirectoryStats {
  const officialOneToOneCount = input
    ? listOfficialOneToOnePairs({
        storeSlugs: input.storeSlugs,
        merchantIds: input.merchantIds,
        decisions: input.decisions ?? [],
      }).length
    : rows.filter((row) => row.canRedeem && row.hasJarExchangeMerchant).length;
  return {
    total: rows.length,
    redeemableCount: rows.filter((row) => row.canRedeem).length,
    jarExchangeCount: rows.filter((row) => row.hasJarExchangeMerchant).length,
    officialOneToOneCount,
    needsReviewCount: rows.filter((row) => row.identityNote === 'needs_review').length,
  };
}
