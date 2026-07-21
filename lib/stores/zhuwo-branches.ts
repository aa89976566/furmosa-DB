/**
 * 豬窩三間分店（寄賣 Merchant ↔ LINE 核銷 Store）
 * merchantId 為偏好編號；若正式庫已被占用，migration 會改用下一個空號，
 * 系統以店名「豬窩 …店」為準同步。
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

export const ZHUWO_BRANCH_NAMES = ZHUWO_CONSIGNMENT_BRANCHES.map((b) => b.name);
