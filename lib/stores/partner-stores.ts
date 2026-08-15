import { prisma } from '@/lib/prisma';
import { getGroomingCouponDiscountForStore } from '@/lib/coupons/store-discount';
import { isCustomerFacingPartnerStore } from '@/lib/stores/partner-store-visibility';

/** DB 無資料時的後備清單（與 migration／zhuwo-branches 一致；豬窩僅列三間分店） */
export const FALLBACK_PARTNER_STORES = [
  { slug: 'zhuwo_zhonghe', name: '豬窩 中和店' },
  { slug: 'zhuwo_banqiao', name: '豬窩 板橋店' },
  { slug: 'zhuwo_tucheng', name: '豬窩 土城店' },
  { slug: 'niuniu', name: '淡水妞妞' },
  { slug: 'manlisa', name: '曼利莎寵物美容' },
  { slug: 'mer_0018', name: '墨菲寵物美學' },
  { slug: 'mer_0014', name: '柒沐寵物美容' },
  { slug: 'pet99', name: '99寵物美容' },
] as const;

export type PartnerStoreSlug = (typeof FALLBACK_PARTNER_STORES)[number]['slug'];

export type PartnerStoreView = {
  id: string;
  slug: string;
  name: string;
  /** 10 點兌換美容折價券面額：豬窩 250、其他合作店 200 */
  groomingDiscountAmount: number;
};

function toView(row: { id: string; slug: string; name: string }): PartnerStoreView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    groomingDiscountAmount: getGroomingCouponDiscountForStore(row.slug, row.name),
  };
}

export type ListPartnerStoresOpts = {
  /** 後台／對帳可設 true；LINE／開戶預設 false（隱藏測試對照店） */
  includeInternal?: boolean;
};

/** 合作店家主檔（stores 表） */
export async function listPartnerStoresFromDb(
  opts?: ListPartnerStoresOpts,
): Promise<PartnerStoreView[]> {
  const includeInternal = opts?.includeInternal === true;
  try {
    const rows = await prisma.store.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true },
    });
    if (rows.length > 0) {
      const views = rows.map(toView);
      return includeInternal
        ? views
        : views.filter((s) => isCustomerFacingPartnerStore(s));
    }
  } catch {
    // 連線失敗時使用後備
  }
  const fallback = FALLBACK_PARTNER_STORES.map((s) => ({
    id: `fallback_${s.slug}`,
    slug: s.slug,
    name: s.name,
    groomingDiscountAmount: getGroomingCouponDiscountForStore(s.slug, s.name),
  }));
  return includeInternal
    ? fallback
    : fallback.filter((s) => isCustomerFacingPartnerStore(s));
}

export async function resolvePartnerStoreBySlug(
  slug: string | null | undefined,
): Promise<PartnerStoreView | null> {
  if (!slug) return null;
  try {
    const row = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (row) return toView(row);
  } catch {
    // fallback below
  }
  const fb = FALLBACK_PARTNER_STORES.find((s) => s.slug === slug);
  return fb
    ? {
        id: `fallback_${fb.slug}`,
        slug: fb.slug,
        name: fb.name,
        groomingDiscountAmount: getGroomingCouponDiscountForStore(fb.slug, fb.name),
      }
    : null;
}

export async function isValidPartnerStoreSlug(slug: string): Promise<boolean> {
  return (await resolvePartnerStoreBySlug(slug)) != null;
}

export function resolvePartnerStoreLabelSync(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return FALLBACK_PARTNER_STORES.find((s) => s.slug === slug)?.name ?? null;
}

export async function resolvePartnerStoreLabel(slug: string | null | undefined): Promise<string | null> {
  return (await resolvePartnerStoreBySlug(slug))?.name ?? resolvePartnerStoreLabelSync(slug);
}

export function storeBindingFromSlug(slug: string | null | undefined) {
  const fb = FALLBACK_PARTNER_STORES.find((s) => s.slug === slug);
  if (!fb) return { storeId: null, storeName: null };
  return { storeId: fb.slug, storeName: fb.name };
}
