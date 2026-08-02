/**
 * 顧客可見的合作店過濾。
 * 測試／對照店（如 seed 的「錯誤店家對照」）不可出現在 LINE／開戶清單。
 */

/** 已知內部／測試 merchant → store slug（MER-OTHER → mer_other） */
export const INTERNAL_PARTNER_STORE_SLUGS = new Set([
  'mer_other',
  'mer_refill',
]);

/** 已知內部 merchantId（同步時跳過） */
export const INTERNAL_MERCHANT_IDS = new Set(['MER-OTHER', 'MER-REFILL']);

const INTERNAL_PARTNER_NAME_RE =
  /錯誤店家|勿交付|換罐測試店|（測試）|\[測試\]|test\s*store/i;

export function isCustomerFacingPartnerStore(store: {
  slug: string;
  name: string;
}): boolean {
  const slug = store.slug.trim().toLowerCase();
  if (INTERNAL_PARTNER_STORE_SLUGS.has(slug)) return false;
  if (INTERNAL_PARTNER_NAME_RE.test(store.name.trim())) return false;
  return true;
}

export function isInternalMerchantId(merchantId: string): boolean {
  return INTERNAL_MERCHANT_IDS.has(merchantId.trim().toUpperCase());
}

/** 依店名粗分區域（故事卡分頁用；未知歸「其他據點」） */
export function inferPartnerStoreRegion(name: string): string {
  const n = name.replace(/\s+/g, '');
  if (/豬窩|中和|板橋|土城|三重|新莊|新店|汐止|淡水|林口|蘆洲/.test(n)) {
    return '新北據點';
  }
  if (/台北|臺北|大安|中山|松山|信義|士林|內湖|文山|北投/.test(n)) {
    return '台北據點';
  }
  if (/桃園|中壢|竹北|新竹/.test(n)) return '北桃竹據點';
  if (/台中|臺中|台南|臺南|高雄/.test(n)) return '中南部據點';
  return '其他據點';
}
