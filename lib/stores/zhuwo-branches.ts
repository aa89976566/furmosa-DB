/**
 * 豬窩三間分店（寄賣 Merchant ↔ LINE 核銷 Store）
 * 寄賣下拉、import、partner fallback 以此為準。
 */
export const ZHUWO_CONSIGNMENT_BRANCHES = [
  {
    merchantId: 'MER-0016',
    name: '豬窩 中和店',
    city: '新北',
    storeSlug: 'zhuwo_zhonghe',
    storeSecretToken: '8k2m1x',
  },
  {
    merchantId: 'MER-0019',
    name: '豬窩 板橋店',
    city: '新北',
    storeSlug: 'zhuwo_banqiao',
    storeSecretToken: '4f9d7k',
  },
  {
    merchantId: 'MER-0020',
    name: '豬窩 土城店',
    city: '新北',
    storeSlug: 'zhuwo_tucheng',
    storeSecretToken: '7p3n8q',
  },
] as const;

export type ZhuwoBranch = (typeof ZHUWO_CONSIGNMENT_BRANCHES)[number];

/** 舊版單一「豬窩」核銷 slug（已併入中和店） */
export const ZHUWO_LEGACY_STORE_SLUG = 'mer_0016';
