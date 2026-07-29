/**
 * 換罐計劃正式內容（單一來源）。
 * LINE Flex／FAQ／後台說明都讀這裡，避免規則散落。
 */

export const REFILL_PLAN_RULES = {
  brandName: '匠寵 FURMOSA',
  concept: '吃完不是結束，帶回空罐，再換一種口味。',
  firstJarPrice: 129,
  exchangePrice: 99,
  /** 必須一罐空罐換一罐新品 */
  oneForOneRequired: true,
  /** 口味／庫存更新節奏文案 */
  flavourUpdateCadence: '每兩週更新',
  stockDisclaimer: '依合作店當期庫存為準',
  serialDigits: 8,
  pointsPerJar: 1,
  pointsForDiscount: 10,
  /** 預設折抵；實際綁定店可能為豬窩 250，顯示時再依店家覆寫 */
  discountAmountDefault: 200,
  heroImagePath: '/images/refill-plan/refill-flavours.jpg',
  heroAlt: '匠寵換罐計劃七種零食口味',
} as const;

export type RefillPlanFaqItem = {
  id: string;
  question: string;
  answer: string;
};

/** 常見問題（正式規則） */
export const REFILL_PLAN_FAQ: RefillPlanFaqItem[] = [
  {
    id: 'price-first',
    question: '第一罐多少錢？',
    answer: '第一罐 NT$129。',
  },
  {
    id: 'price-exchange',
    question: '換罐多少錢？',
    answer: '下次美容帶回一個匠寵空罐，可用 NT$99 換一罐新口味。',
  },
  {
    id: 'no-empty',
    question: '可以不帶空罐嗎？',
    answer: '換罐價必須完成一罐換一罐。沒帶空罐時，不可直接以 NT$99 領取新品。',
  },
  {
    id: 'choose-flavour',
    question: '可以自己選口味嗎？',
    answer: '可以從預約店家當期有庫存的口味中選擇。各店品項每兩週更新。',
  },
  {
    id: 'serial-where',
    question: '序號在哪裡？',
    answer: '每個罐底都有一組 8 位數字序號。',
  },
  {
    id: 'how-points',
    question: '如何集點？',
    answer: '建立毛孩帳號後，於官方 LINE 輸入罐底序號，每個有效序號累積 1 點。',
  },
  {
    id: 'ten-points',
    question: '集滿 10 點可以做什麼？',
    answer: '可於帳號綁定的合作美容店折抵 NT$200 美容費。',
  },
  {
    id: 'points-share',
    question: '不同店家的點數可以共用嗎？',
    answer: '折價使用規則依帳號綁定的合作店為準；開戶完成後會顯示你綁定的店家。',
  },
  {
    id: 'all-seven',
    question: '每間店都有七種口味嗎？',
    answer: '不一定。七種為目前換罐系列，實際可選品項依各合作店當期庫存為準。',
  },
];

export type RefillIntroStep = {
  no: string;
  title: string;
  body: string;
};

export const REFILL_INTRO_STEPS: RefillIntroStep[] = [
  {
    no: '01',
    title: '先帶一罐回家',
    body: '第一罐 NT$129，於合作美容店取貨。',
  },
  {
    no: '02',
    title: '吃完留下空罐',
    body: '下次預約美容時，把空罐一起帶回來。',
  },
  {
    no: '03',
    title: 'NT$99 換新口味',
    body: '店家確認空罐後，交付本期可選的新罐。',
  },
  {
    no: '04',
    title: '輸入瓶底序號',
    body: '每罐累積 1 點，滿 10 點折 NT$200 美容費。',
  },
];

export const REFILL_INTRO_COPY = {
  flexTitle: '匠寵換罐計劃',
  headline: '吃完，不用說再見。',
  bodyLines: [
    '第一罐 NT$129。',
    '下次美容帶回空罐，',
    'NT$99 就能換一罐新口味。',
    '',
    '每個瓶底都有專屬 8 位序號。',
    '加入官方 LINE、建立毛孩帳號，',
    '輸入序號即可累積 1 點。',
    '',
    '集滿 10 點，',
    '可在綁定的合作美容店',
    '折抵 NT$200 美容費。',
  ],
  tags: ['7 種口味', '每兩週更新', '合作店取貨'] as const,
  flavourSectionTitle: '這期想吃哪一罐？',
  flavourSectionLead: [
    '目前共有 7 種口味，',
    '各合作店可選品項每兩週更新一次。',
    '',
    '依合作店當期庫存為準。',
  ],
  ctaStart: '開始換罐',
  ctaFlavours: '看本期口味',
  ctaStores: '查看合作店',
} as const;

/** 預設七種口味（seed／後備；正式顯示以 DB isActive 為準） */
export const DEFAULT_REFILL_FLAVOURS = [
  { code: 'veggie-25', name: '蔬果凍乾', weightGrams: 25, sortOrder: 1 },
  { code: 'beef-20', name: '牛肉凍乾', weightGrams: 20, sortOrder: 2 },
  { code: 'chicken-20', name: '雞肉凍乾', weightGrams: 20, sortOrder: 3 },
  { code: 'crystal-fish-10', name: '水晶魚凍乾', weightGrams: 10, sortOrder: 4 },
  { code: 'anchovy-15', name: '丁香魚凍乾', weightGrams: 15, sortOrder: 5 },
  { code: 'duck-throat-15', name: '鴨喉嚨凍乾', weightGrams: 15, sortOrder: 6 },
  { code: 'pig-ear-30', name: '豬耳朵凍乾', weightGrams: 30, sortOrder: 7 },
] as const;

export function formatFlavourLabel(name: string, weightGrams: number): string {
  return `${name}｜${weightGrams}g`;
}
