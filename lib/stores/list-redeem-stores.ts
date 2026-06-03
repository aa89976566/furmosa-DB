import {
  FALLBACK_PARTNER_STORES,
  listPartnerStoresFromDb,
  type PartnerStoreView,
} from '@/lib/stores/partner-stores';

export type RedeemStoreOption = {
  slug: string;
  name: string;
};

const DB_TIMEOUT_MS = 2500;

function toOptions(stores: PartnerStoreView[]): RedeemStoreOption[] {
  return stores.map((s) => ({ slug: s.slug, name: s.name }));
}

/** 同步後備清單（核銷頁必須能立即渲染，不可等 DB） */
export function listRedeemStoresSync(): RedeemStoreOption[] {
  return FALLBACK_PARTNER_STORES.map((s) => ({ slug: s.slug, name: s.name }));
}

/** 優先讀 DB，逾時或失敗時回退內建清單 */
export async function listRedeemStores(): Promise<RedeemStoreOption[]> {
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
