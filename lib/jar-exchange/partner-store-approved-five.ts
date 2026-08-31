export const APPROVED_PARTNER_STORE_PAIRS = [
  {
    merchantId: 'MER-0019',
    legacySlug: 'zhuwo_banqiao',
    label: '豬窩 板橋店',
    rationale: '總部確認：豬窩板橋舊核銷店與 MER-0019 是同一實際門市；三間豬窩分店分開保留。',
  },
  {
    merchantId: 'MER-0020',
    legacySlug: 'zhuwo_tucheng',
    label: '豬窩 土城店',
    rationale: '總部確認：豬窩土城舊核銷店與 MER-0020 是同一實際門市；三間豬窩分店分開保留。',
  },
  {
    merchantId: 'MER-0016',
    legacySlug: 'zhuwo_zhonghe',
    label: '豬窩 中和店',
    rationale: '總部確認：豬窩中和舊核銷店與 MER-0016 是同一實際門市；三間豬窩分店分開保留。',
  },
  {
    merchantId: 'MER-0017',
    legacySlug: 'manlisa',
    label: '曼利莎寵物美容',
    rationale: '總部確認：曼利莎舊核銷店與 MER-0017 是同一實際門市；舊 slug 繼續作核銷連結。',
  },
  {
    merchantId: 'MER-0010',
    legacySlug: 'niuniu',
    label: '淡水妞妞',
    rationale: '總部確認：淡水妞妞舊核銷店與 MER-0010 是同一實際門市；既有 POS 店員歸屬不變。',
  },
] as const;

export const APPROVED_PARTNER_STORE_COUNT = APPROVED_PARTNER_STORE_PAIRS.length;
