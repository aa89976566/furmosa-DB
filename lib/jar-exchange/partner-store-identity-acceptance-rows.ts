import type { PartnerStoreIdentityVerdict } from '@/lib/jar-exchange/partner-store-identity-decisions';

export type PreviewAcceptanceRow = {
  merchantId: string;
  legacySlug: string | null;
  verdict: PartnerStoreIdentityVerdict;
  rationale: string;
};

/**
 * Preview 驗收資料清單。這不是清單讀取來源，也不會自動寫入。
 */
export const PREVIEW_ACCEPTANCE_ROWS: PreviewAcceptanceRow[] = [
  {
    merchantId: 'MER-0019',
    legacySlug: 'zhuwo_banqiao',
    verdict: 'same_store',
    rationale: '總部人工判斷：豬窩板橋門市。舊核銷 zhuwo_banqiao 與 MER-0019 為同一家；與土城、中和分開。',
  },
  {
    merchantId: 'MER-0020',
    legacySlug: 'zhuwo_tucheng',
    verdict: 'same_store',
    rationale: '總部人工判斷：豬窩土城門市。舊核銷 zhuwo_tucheng 與 MER-0020 為同一家；與板橋、中和分開。',
  },
  {
    merchantId: 'MER-0016',
    legacySlug: 'zhuwo_zhonghe',
    verdict: 'same_store',
    rationale: '總部人工判斷：豬窩中和門市。舊核銷 zhuwo_zhonghe 與 MER-0016 為同一家；與板橋、土城分開。',
  },
  {
    merchantId: 'MER-0017',
    legacySlug: 'manlisa',
    verdict: 'same_store',
    rationale: '總部人工判斷：曼利莎寵物美容。舊核銷 manlisa 與 MER-0017 為同一家。',
  },
  {
    merchantId: 'MER-0010',
    legacySlug: 'niuniu',
    verdict: 'same_store',
    rationale: '總部人工判斷：淡水妞妞。舊核銷 niuniu 與 MER-0010 為同一家。',
  },
  {
    merchantId: 'MER-OTHER',
    legacySlug: 'mer_other',
    verdict: 'test',
    rationale: '總部人工判斷：錯誤店家對照，系統／測試資料。不刪除。',
  },
  {
    merchantId: 'MER-REFILL',
    legacySlug: 'mer_refill',
    verdict: 'test',
    rationale:
      '總部人工判斷：匠寵換罐測試店。不刪除。測試換罐 #RFP-260729-12Z5 不計正式合作門市與營運 KPI。',
  },
  {
    merchantId: 'MER-DEMO',
    legacySlug: null,
    verdict: 'demo',
    rationale: '總部人工判斷：Furmosa Preview 示範店。不刪除、不新增核銷 slug。',
  },
];
