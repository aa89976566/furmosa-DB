import { isValidPartnerStoreSlug } from '@/lib/stores/partner-stores';

/**
 * LINE 開戶／優惠券店家識別
 * 主資料來源：stores 表（見 lib/stores/partner-stores.ts）
 */
export {
  FALLBACK_PARTNER_STORES as SIGNUP_STORES,
  type PartnerStoreSlug as SignupStoreId,
  listPartnerStoresFromDb as listSignupStores,
  resolvePartnerStoreBySlug as resolveSignupStore,
  resolvePartnerStoreLabelSync as resolveSignupStoreLabel,
  storeBindingFromSlug as storeBindingFromSignupStore,
} from '@/lib/stores/partner-stores';

/** @deprecated 請改用 listSignupStores() 從 DB 讀取 */
export const SIGNUP_STORE_IDS = [
  'zhuwo_zhonghe',
  'zhuwo_banqiao',
  'zhuwo_tucheng',
  'niuniu',
  'manlisa',
  'pet99',
] as const;

/** LINE postback 驗證用；查 DB stores 表 */
export async function isSignupStoreId(code: string): Promise<boolean> {
  return isValidPartnerStoreSlug(code);
}
