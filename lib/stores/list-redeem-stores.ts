import { unstable_cache } from 'next/cache';
import {
  FALLBACK_PARTNER_STORES,
  listPartnerStoresFromDb,
  type PartnerStoreView,
} from '@/lib/stores/partner-stores';
import { getGroomingCouponDiscountForStore } from '@/lib/coupons/store-discount';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { withRuntimeCache } from '@/lib/runtime-cache';

export type RedeemStoreOption = {
  slug: string;
  name: string;
  groomingDiscountAmount: number;
};

const DB_TIMEOUT_MS = 2500;

function toOptions(stores: PartnerStoreView[]): RedeemStoreOption[] {
  return stores.map((s) => ({
    slug: s.slug,
    name: s.name,
    groomingDiscountAmount: s.groomingDiscountAmount,
  }));
}

/** 同步後備清單（核銷頁必須能立即渲染，不可等 DB） */
export function listRedeemStoresSync(): RedeemStoreOption[] {
  return FALLBACK_PARTNER_STORES.map((s) => ({
    slug: s.slug,
    name: s.name,
    groomingDiscountAmount: getGroomingCouponDiscountForStore(s.slug, s.name),
  }));
}

async function loadRedeemStoresUncached(): Promise<RedeemStoreOption[]> {
  try {
    const rows = await Promise.race([
      listPartnerStoresFromDb(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('store-list-timeout')), DB_TIMEOUT_MS);
      }),
    ]);
    if (rows.length > 0) return toOptions(rows);
  } catch {
    // DB 不可用時仍顯示核銷頁
  }
  return listRedeemStoresSync();
}

/**
 * 優先讀 Runtime／Data Cache，再 DB；逾時或失敗回退內建清單。
 * 讓 /store-redeem ISR HTML 在 CDN HIT 時 Origin 也不必每次打庫。
 */
export async function listRedeemStores(): Promise<RedeemStoreOption[]> {
  return withRuntimeCache(
    'redeem-stores-v1',
    {
      ttlSeconds: 60,
      tags: [CACHE_TAGS.redeemStores],
      name: 'redeem-stores',
    },
    () =>
      unstable_cache(loadRedeemStoresUncached, ['redeem-stores-v1'], {
        revalidate: 60,
        tags: [CACHE_TAGS.redeemStores],
      })(),
  );
}
