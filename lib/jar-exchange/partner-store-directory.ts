import type { JarExchangeMerchantRow } from '@/lib/jar-exchange/partner-merchants';
import { getGroomingCouponDiscountForStore } from '@/lib/coupons/store-discount';
import type { MerchantType } from '@/lib/merchant-types';
import type { PartnerStoreView } from '@/lib/stores/partner-stores';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

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
};

export type PartnerStoreDirectoryStats = {
  total: number;
  redeemableCount: number;
  jarExchangeCount: number;
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

/** 以 slug 對應核銷店家與換罐後台店家，合成一份顯示清單 */
export function mergePartnerStoreDirectory(input: {
  stores: PartnerStoreView[];
  merchants: JarExchangeMerchantRow[];
}): PartnerStoreDirectoryRow[] {
  const rows = new Map<string, PartnerStoreDirectoryRow>();

  for (const store of input.stores) {
    const slug = store.slug.trim();
    if (!slug) continue;
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
      merchantId: null,
    });
  }

  for (const merchant of input.merchants) {
    const slug = merchantToStoreSlug(merchant.merchantId);
    if (!slug) continue;
    const existing = rows.get(slug);
    if (existing) {
      if (existing.hasJarExchangeMerchant) continue;
      existing.merchantName = merchant.name;
      existing.namesDiffer = namesDiffer(existing.name, merchant.name);
      existing.city = merchant.city;
      existing.types = merchant.types;
      existing.hasJarExchangeMerchant = true;
      existing.merchantRecordId = merchant.id;
      existing.merchantId = merchant.merchantId;
      continue;
    }

    rows.set(slug, {
      key: slug,
      slug,
      name: merchant.name,
      merchantName: merchant.name,
      namesDiffer: false,
      city: merchant.city,
      types: merchant.types,
      canRedeem: false,
      hasJarExchangeMerchant: true,
      groomingDiscountAmount: getGroomingCouponDiscountForStore(slug, merchant.name),
      merchantRecordId: merchant.id,
      merchantId: merchant.merchantId,
    });
  }

  return [...rows.values()].sort(compareDirectoryRows);
}

export function partnerStoreDirectoryStats(
  rows: PartnerStoreDirectoryRow[],
): PartnerStoreDirectoryStats {
  return {
    total: rows.length,
    redeemableCount: rows.filter((row) => row.canRedeem).length,
    jarExchangeCount: rows.filter((row) => row.hasJarExchangeMerchant).length,
  };
}
